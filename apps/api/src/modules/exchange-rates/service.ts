import { and, desc, eq, sql } from "drizzle-orm"
import { exchangeRates } from "@workspace/db"
import { db } from "@/db"

const PG_INT_MAX = 2_147_483_647

async function fetchRatesFromApi(
  base: string,
  date: Date
): Promise<Record<string, number>> {
  const dateStr = date.toISOString().split("T")[0]
  const baseLower = base.toLowerCase()

  const urls = [
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${dateStr}/v1/currencies/${baseLower}.min.json`,
    `https://${dateStr}.currency-api.pages.dev/v1/currencies/${baseLower}.min.json`,
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${dateStr}/v1/currencies/${baseLower}.json`,
    `https://${dateStr}.currency-api.pages.dev/v1/currencies/${baseLower}.json`,
  ]

  let lastError: Error | null = null

  for (const url of urls) {
    try {
      const res = await fetch(url)
      if (!res.ok) {
        lastError = new Error(`HTTP ${res.status} from ${url}`)
        continue
      }

      const data = await res.json()
      const rawRates: Record<string, number> = data[baseLower]

      if (!rawRates) {
        lastError = new Error(`No rates found for ${base} in response`)
        continue
      }

      const normalized: Record<string, number> = {}
      for (const [key, value] of Object.entries(rawRates)) {
        if (typeof value === "number") {
          normalized[key.toUpperCase()] = value
        }
      }
      return normalized
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      console.warn(`Failed to fetch from ${url}: ${lastError.message}`)
    }
  }

  throw lastError ?? new Error("Failed to fetch exchange rates")
}

async function findCachedRate(
  date: string,
  base: string,
  target: string
): Promise<number | null> {
  const rows = await db
    .select({ rate: exchangeRates.rate })
    .from(exchangeRates)
    .where(
      and(
        eq(exchangeRates.date, date),
        eq(exchangeRates.base, base),
        eq(exchangeRates.target, target)
      )
    )
    .limit(1)

  return rows[0]?.rate ?? null
}

async function findLatestCachedRate(
  base: string,
  target: string
): Promise<number | null> {
  const rows = await db
    .select({ rate: exchangeRates.rate })
    .from(exchangeRates)
    .where(and(eq(exchangeRates.base, base), eq(exchangeRates.target, target)))
    .orderBy(desc(exchangeRates.date))
    .limit(1)

  return rows[0]?.rate ?? null
}

async function upsertRates(
  date: string,
  base: string,
  rates: Record<string, number>
): Promise<void> {
  const values = Object.entries(rates).map(([target, rate]) => ({
    date,
    base,
    target,
    rate,
  }))

  if (values.length === 0) return

  await db
    .insert(exchangeRates)
    .values(values)
    .onConflictDoUpdate({
      target: [exchangeRates.date, exchangeRates.base, exchangeRates.target],
      set: { rate: sql`excluded.rate` },
    })
}

export async function getRate(
  base: string,
  target: string,
  date: Date,
  usedCurrencies?: string[]
): Promise<number> {
  if (base === target) return 1

  const dateStr = date.toISOString().split("T")[0]

  const cached = await findCachedRate(dateStr, base, target)
  if (cached !== null) return cached

  let allRates: Record<string, number>
  try {
    allRates = await fetchRatesFromApi(base, date)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const fallback = await findLatestCachedRate(base, target)
    if (fallback !== null) {
      console.warn(
        `Exchange rate API failed for ${base}->${target} on ${dateStr} (${message}); using latest cached rate`
      )
      return fallback
    }
    throw err
  }

  const allowedTargets = usedCurrencies
    ? new Set(usedCurrencies.map((c) => c.toUpperCase()))
    : null
  const baseUpper = base.toUpperCase()
  const rates = Object.fromEntries(
    Object.entries(allRates).filter(
      ([code, value]) =>
        code.length <= 3 &&
        code.toUpperCase() !== baseUpper &&
        Math.round(value * 1_000_000) <= PG_INT_MAX &&
        (!allowedTargets || allowedTargets.has(code.toUpperCase()))
    )
  )
  await upsertRates(dateStr, base, rates)

  const rate = rates[target]
  if (rate === undefined) {
    console.warn(`No rate found for ${base}->${target} on ${dateStr}`)
    return 1
  }

  return rate
}

export async function getLatestRates(
  currencies: string[]
): Promise<Record<string, Record<string, number>>> {
  const result: Record<string, Record<string, number>> = {}
  const today = new Date()

  for (const base of currencies) {
    result[base] = {}
    for (const target of currencies) {
      if (base === target) continue
      result[base][target] = await getRate(base, target, today, currencies)
    }
  }

  return result
}
