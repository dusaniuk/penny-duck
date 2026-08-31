/**
 * One-time importer for the "2026 expences" Google Sheets export (.xlsx).
 *
 * Usage:
 *   bun scripts/import-spreadsheet.ts --lookup            # print org/user/account ids
 *   bun scripts/import-spreadsheet.ts <file.xlsx>         # dry run (default)
 *   bun scripts/import-spreadsheet.ts <file.xlsx> --commit
 *
 * DATABASE_URL decides the target database (loaded from repo root .env if unset).
 */
import { readFileSync } from "node:fs"
import { config } from "dotenv"
import { and, eq, isNull } from "drizzle-orm"
import * as XLSX from "xlsx"
import { createDbClient } from "../src/client"
import {
  accounts,
  categories,
  organizationMembers,
  organizations,
  transactions,
  users,
} from "../src/schema"

config({ path: new URL("../../../.env", import.meta.url).pathname })

// ---------------------------------------------------------------------------
// Hardcoded config — fill in ids from `--lookup` before running --commit
// ---------------------------------------------------------------------------

const CONFIG = {
  organizationId: "",
  people: {
    A: { userId: "", accountId: "" },
    M: { userId: "", accountId: "" },
  } as Record<string, { userId: string; accountId: string }>,
  year: 2026,
  monthTabs: [
    "01 Jan",
    "02 Feb",
    "03 Mar",
    "04 Apr",
    "05 May",
    "06 Jun",
    "07 Jul",
    "08 Aug",
    "09 Sept",
    "10 Oct",
    "11 Nov",
    "12 Dec",
  ],
  categoriesTab: "Categories",
  incomeGrouping: "Доходи",
}

const GROUPING_COLORS: Record<string, string> = {
  Доходи: "green",
  "Базові витрати": "blue",
  "Загальні витрати": "amber",
  Розваги: "purple",
  Подорожі: "teal",
  Заощадження: "slate",
}
const FALLBACK_COLORS = ["coral", "indigo", "mint", "rose", "cyan", "plum"]

const CURRENCY_SYMBOLS: Record<string, string> = {
  "€": "EUR",
  $: "USD",
  "£": "GBP",
  "₴": "UAH",
  zł: "PLN",
  kr: "SEK",
  Kč: "CZK",
  Ft: "HUF",
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
  jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
}

interface Issue {
  tab: string
  row: number
  message: string
}

function parseDate(value: unknown, tab: string, row: number, issues: Issue[]): Date | null {
  if (value == null || value === "") return null
  if (value instanceof Date) {
    if (value.getFullYear() !== CONFIG.year) {
      issues.push({ tab, row, message: `date year ${value.getFullYear()} != ${CONFIG.year}, kept as-is` })
    }
    return new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate(), 12))
  }
  const s = String(value).trim()
  // "March 1", "Mar 1", "1 March"
  const m =
    s.match(/^([A-Za-z]+)\s+(\d{1,2})$/) ?? s.match(/^(\d{1,2})\s+([A-Za-z]+)$/)
  if (m) {
    const [a, b] = [m[1], m[2]]
    const monthName = /^\d/.test(a) ? b : a
    const day = Number(/^\d/.test(a) ? a : b)
    const month = MONTHS[monthName.slice(0, 3).toLowerCase()]
    if (month !== undefined && day >= 1 && day <= 31) {
      return new Date(Date.UTC(CONFIG.year, month, day, 12))
    }
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) {
    return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12))
  }
  issues.push({ tab, row, message: `unparseable date "${s}"` })
  return null
}

function parseAmount(value: unknown): number | null {
  if (value == null || value === "") return null
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  const cleaned = String(value)
    .replace(/[^\d.,-]/g, "")
    .replace(/,(?=\d{3}(\D|$))/g, "") // thousands separators
    .replace(",", ".") // decimal comma
  const n = Number(cleaned)
  return Number.isFinite(n) && cleaned !== "" ? n : null
}

function parseOriginalCurrency(
  value: unknown
): { amount: number; currency: string } | null {
  if (value == null || value === "") return null
  const s = String(value).trim()
  const amount = parseAmount(s)
  if (amount == null) return null
  for (const [symbol, code] of Object.entries(CURRENCY_SYMBOLS)) {
    if (s.includes(symbol)) return { amount: Math.abs(amount), currency: code }
  }
  const code = s.match(/\b([A-Z]{3})\b/)
  if (code) return { amount: Math.abs(amount), currency: code[1] }
  return null
}

// ---------------------------------------------------------------------------
// Categories tab → { originalName: { parent, sub, type } }
// ---------------------------------------------------------------------------

interface CategoryMapping {
  parent: string
  sub: string
  type: "expense" | "income"
}

function stripPrefix(name: string): string {
  const idx = name.indexOf(":")
  return idx === -1 ? name : name.slice(idx + 1).trim()
}

function readCategoryMap(wb: XLSX.WorkBook): Map<string, CategoryMapping> {
  const ws = wb.Sheets[CONFIG.categoriesTab]
  if (!ws) throw new Error(`Tab "${CONFIG.categoriesTab}" not found`)
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    header: ["grouping", "category"],
    range: 1, // skip header row
    defval: "",
  })
  const map = new Map<string, CategoryMapping>()
  let currentGrouping = ""
  for (const row of rows) {
    const grouping = String(row.grouping ?? "").trim()
    const category = String(row.category ?? "").trim()
    if (grouping) currentGrouping = grouping
    if (!category || !currentGrouping) continue
    map.set(category, {
      parent: currentGrouping,
      sub: stripPrefix(category),
      type: currentGrouping === CONFIG.incomeGrouping ? "income" : "expense",
    })
  }
  return map
}

// Fallback for categories used in monthly tabs but absent from the Categories tab
function fallbackMapping(name: string): CategoryMapping {
  const idx = name.indexOf(":")
  const type = name.startsWith("Дохід") ? "income" : "expense"
  if (idx === -1) return { parent: name, sub: name, type }
  return { parent: name.slice(0, idx).trim(), sub: name.slice(idx + 1).trim(), type }
}

// ---------------------------------------------------------------------------
// Monthly tabs → parsed rows
// ---------------------------------------------------------------------------

interface ParsedRow {
  tab: string
  rowNum: number
  date: Date
  categoryName: string
  note: string | null
  amount: number // positive
  type: "expense" | "income"
  person: string
  originalAmount: number | null
  originalCurrency: string | null
  exchangeRate: number | null
}

const HEADER_ALIASES: Record<string, string> = {
  date: "date",
  category: "category",
  description: "note",
  expense: "amount",
  transactions: "amount",
  person: "person",
  "original currency": "original",
  "exchange rate": "rate",
}

function readMonthTab(
  wb: XLSX.WorkBook,
  tab: string,
  categoryMap: Map<string, CategoryMapping>,
  unmapped: Map<string, number>,
  issues: Issue[]
): ParsedRow[] {
  const ws = wb.Sheets[tab]
  if (!ws) {
    issues.push({ tab, row: 0, message: "tab not found, skipped" })
    return []
  }
  const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null })
  const headerIdx = grid.findIndex(
    (r) =>
      r.some((c) => String(c ?? "").trim().toLowerCase() === "date") &&
      r.some((c) => String(c ?? "").trim().toLowerCase() === "category")
  )
  if (headerIdx === -1) {
    issues.push({ tab, row: 0, message: "no Date/Category header row found, skipped" })
    return []
  }
  const cols: Record<string, number> = {}
  grid[headerIdx].forEach((cell, i) => {
    const key = HEADER_ALIASES[String(cell ?? "").trim().toLowerCase()]
    if (key && cols[key] === undefined) cols[key] = i
  })
  for (const required of ["date", "category", "amount"]) {
    if (cols[required] === undefined) {
      issues.push({ tab, row: headerIdx + 1, message: `missing "${required}" column, tab skipped` })
      return []
    }
  }

  const parsed: ParsedRow[] = []
  for (let i = headerIdx + 1; i < grid.length; i++) {
    const row = grid[i]
    const rowNum = i + 1
    const categoryName = String(row[cols.category] ?? "").trim()
    const amountRaw = row[cols.amount]
    if (!categoryName && (amountRaw == null || amountRaw === "")) continue // blank row

    const amount = parseAmount(amountRaw)
    if (!categoryName || amount == null) {
      issues.push({ tab, row: rowNum, message: `incomplete row (category="${categoryName}", amount="${amountRaw}"), skipped` })
      continue
    }
    if (amount === 0) continue

    const date = parseDate(row[cols.date], tab, rowNum, issues)
    if (!date) {
      issues.push({ tab, row: rowNum, message: `row has amount but no date, skipped` })
      continue
    }

    let mapping = categoryMap.get(categoryName)
    if (!mapping) {
      unmapped.set(categoryName, (unmapped.get(categoryName) ?? 0) + 1)
      mapping = fallbackMapping(categoryName)
    }

    const person = String(row[cols.person] ?? "").trim()
    const original = parseOriginalCurrency(row[cols.original])
    let exchangeRate: number | null = null
    if (original) {
      const sheetRate = parseAmount(row[cols.rate])
      exchangeRate =
        sheetRate ?? Math.round((Math.abs(amount) / original.amount) * 1e6) / 1e6
    }

    parsed.push({
      tab,
      rowNum,
      date,
      categoryName,
      note: String(row[cols.note] ?? "").trim() || null,
      amount: Math.abs(amount),
      type: mapping.type,
      person,
      originalAmount: original?.amount ?? null,
      originalCurrency: original?.currency ?? null,
      exchangeRate,
    })
  }
  return parsed
}

// ---------------------------------------------------------------------------
// Modes
// ---------------------------------------------------------------------------

const db = createDbClient(process.env.DATABASE_URL!)

async function lookup() {
  const orgs = await db.select().from(organizations)
  for (const org of orgs) {
    console.log(`\norganization: ${org.name}  ${org.id}`)
    const members = await db
      .select({ userId: users.id, email: users.email, name: users.name, role: organizationMembers.role })
      .from(organizationMembers)
      .innerJoin(users, eq(users.id, organizationMembers.userId))
      .where(eq(organizationMembers.organizationId, org.id))
    for (const m of members) console.log(`  user: ${m.name} <${m.email}> (${m.role})  ${m.userId}`)
    const accts = await db
      .select({ id: accounts.id, name: accounts.name, type: accounts.type, currency: accounts.currency })
      .from(accounts)
      .where(eq(accounts.organizationId, org.id))
    for (const a of accts) console.log(`  account: ${a.name} [${a.type} ${a.currency}]  ${a.id}`)
  }
}

function validateConfig() {
  const missing: string[] = []
  if (!CONFIG.organizationId) missing.push("organizationId")
  for (const [key, p] of Object.entries(CONFIG.people)) {
    if (!p.userId) missing.push(`people.${key}.userId`)
    if (!p.accountId) missing.push(`people.${key}.accountId`)
  }
  if (missing.length) {
    console.error(`CONFIG is incomplete: ${missing.join(", ")}. Run --lookup and fill in the ids.`)
    process.exit(1)
  }
}

function money(n: number): string {
  return n.toFixed(2).padStart(12)
}

async function run(file: string, commit: boolean) {
  const wb = XLSX.read(readFileSync(file), { cellDates: true })
  const issues: Issue[] = []
  const unmapped = new Map<string, number>()
  const categoryMap = readCategoryMap(wb)

  const rows: ParsedRow[] = []
  for (const tab of CONFIG.monthTabs) {
    rows.push(...readMonthTab(wb, tab, categoryMap, unmapped, issues))
  }

  // --- report -------------------------------------------------------------
  console.log(`\nParsed ${rows.length} transactions from ${CONFIG.monthTabs.length} tabs\n`)

  console.log("Per tab:")
  for (const tab of CONFIG.monthTabs) {
    const tabRows = rows.filter((r) => r.tab === tab)
    if (!tabRows.length) continue
    const expenses = tabRows.filter((r) => r.type === "expense").reduce((s, r) => s + r.amount, 0)
    const income = tabRows.filter((r) => r.type === "income").reduce((s, r) => s + r.amount, 0)
    console.log(`  ${tab}: ${String(tabRows.length).padStart(4)} rows  expenses ${money(expenses)}  income ${money(income)}`)
  }

  console.log("\nCategory tree (unique parent → sub, with row counts and totals):")
  const byCat = new Map<string, { mapping: CategoryMapping; count: number; total: number }>()
  for (const r of rows) {
    const mapping = categoryMap.get(r.categoryName) ?? fallbackMapping(r.categoryName)
    const entry = byCat.get(r.categoryName) ?? { mapping, count: 0, total: 0 }
    entry.count += 1
    entry.total += r.amount
    byCat.set(r.categoryName, entry)
  }
  const parents = [...new Set([...byCat.values()].map((e) => e.mapping.parent))]
  for (const parent of parents) {
    console.log(`  ${parent}`)
    for (const [name, e] of byCat) {
      if (e.mapping.parent !== parent) continue
      console.log(`    ${e.mapping.sub} (${e.mapping.type})  ${e.count} rows  ${money(e.total)}   [sheet: "${name}"]`)
    }
  }

  if (unmapped.size) {
    console.log("\n⚠ Categories not in the Categories tab (colon-split fallback applied):")
    for (const [name, count] of unmapped) console.log(`  "${name}" — ${count} rows`)
  }

  const persons = new Map<string, number>()
  for (const r of rows) persons.set(r.person, (persons.get(r.person) ?? 0) + 1)
  console.log("\nPerson column values:")
  for (const [p, count] of persons) {
    const known = CONFIG.people[p] ? "" : "  ⚠ NOT IN CONFIG"
    console.log(`  "${p}": ${count} rows${known}`)
  }
  const unknownPersons = [...persons.keys()].filter((p) => !CONFIG.people[p])

  if (issues.length) {
    console.log(`\n⚠ ${issues.length} row issues:`)
    for (const i of issues.slice(0, 50)) console.log(`  [${i.tab} row ${i.row}] ${i.message}`)
    if (issues.length > 50) console.log(`  … and ${issues.length - 50} more`)
  }

  if (!commit) {
    console.log("\nDry run — nothing written. Re-run with --commit to import.")
    return
  }

  // --- commit -------------------------------------------------------------
  validateConfig()
  if (unknownPersons.length) {
    console.error(`\nCannot commit: person values not in CONFIG.people: ${unknownPersons.map((p) => `"${p}"`).join(", ")}`)
    process.exit(1)
  }
  if (!rows.length) {
    console.error("\nNothing to import.")
    process.exit(1)
  }

  const orgId = CONFIG.organizationId
  await db.transaction(async (tx) => {
    // get-or-create parents, then subs
    const catIds = new Map<string, string>() // sheet category name → category id
    const parentIds = new Map<string, string>()
    let colorIdx = 0

    const neededParents = new Map<string, "expense" | "income">()
    for (const { mapping } of byCat.values()) {
      neededParents.set(mapping.parent, mapping.type)
    }
    for (const [parentName, type] of neededParents) {
      const existing = await tx
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.organizationId, orgId), eq(categories.name, parentName), isNull(categories.parentId)))
      if (existing[0]) {
        parentIds.set(parentName, existing[0].id)
        continue
      }
      const color = GROUPING_COLORS[parentName] ?? FALLBACK_COLORS[colorIdx++ % FALLBACK_COLORS.length]
      const [created] = await tx
        .insert(categories)
        .values({ organizationId: orgId, parentId: null, name: parentName, type, color })
        .returning({ id: categories.id })
      parentIds.set(parentName, created.id)
      console.log(`created parent category "${parentName}" (${type}, ${color})`)
    }

    for (const [sheetName, { mapping }] of byCat) {
      const parentId = parentIds.get(mapping.parent)!
      const existing = await tx
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.organizationId, orgId), eq(categories.name, mapping.sub), eq(categories.parentId, parentId)))
      if (existing[0]) {
        catIds.set(sheetName, existing[0].id)
        continue
      }
      const [created] = await tx
        .insert(categories)
        .values({ organizationId: orgId, parentId, name: mapping.sub, type: mapping.type })
        .returning({ id: categories.id })
      catIds.set(sheetName, created.id)
      console.log(`created category "${mapping.parent}" → "${mapping.sub}" (${mapping.type})`)
    }

    const values = rows.map((r) => {
      const person = CONFIG.people[r.person]
      return {
        organizationId: orgId,
        accountId: person.accountId,
        amount: r.type === "expense" ? -r.amount : r.amount,
        categoryId: catIds.get(r.categoryName)!,
        note: r.note?.slice(0, 500) ?? null,
        date: r.date,
        settled: true,
        originalAmount: r.originalAmount,
        originalCurrency: r.originalCurrency,
        exchangeRate: r.exchangeRate,
        madeById: person.userId,
      }
    })
    const BATCH = 500
    for (let i = 0; i < values.length; i += BATCH) {
      await tx.insert(transactions).values(values.slice(i, i + BATCH))
    }
    console.log(`\nInserted ${values.length} transactions.`)
  })
  console.log("Committed ✅")
}

// ---------------------------------------------------------------------------

const args = process.argv.slice(2)
if (args.includes("--lookup")) {
  await lookup()
} else {
  const file = args.find((a) => !a.startsWith("--"))
  if (!file) {
    console.error("Usage: bun scripts/import-spreadsheet.ts <file.xlsx> [--commit] | --lookup")
    process.exit(1)
  }
  await run(file, args.includes("--commit"))
}
process.exit(0)
