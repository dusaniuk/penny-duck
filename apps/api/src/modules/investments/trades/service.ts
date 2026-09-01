import { HTTPException } from "hono/http-exception"
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  lte,
  sql,
  type SQL,
} from "drizzle-orm"
import type {
  ImportTradesResponse,
  ImportTradesRow,
  ImportTradesSummary,
  Trade,
} from "@workspace/api-contract"
import { accounts, instruments, trades } from "@workspace/db"
import { db } from "@/db"
import { parseIbkrCsv } from "../import/ibkr-csv-parser"
import type { ParsedEvent, ParsedImport } from "../import/types"
import { assertNonNegative } from "../helpers/assert-non-negative"
import {
  toTradeResponse,
  type TradeRow,
  type TradeWithSymbol,
} from "../helpers/mappers"
import { type ReplayTrade } from "../helpers/replay-position"
import { ensureInstrumentBySymbol } from "../instruments/service"

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]
type Executor = typeof db | Tx

const EXTERNAL_SOURCE = "ibkr_flex_query"

// ---------- Internal Drizzle helpers ----------

async function findTradeById(
  id: string,
  organizationId: string
): Promise<TradeRow | null> {
  const rows = await db
    .select()
    .from(trades)
    .where(and(eq(trades.id, id), eq(trades.organizationId, organizationId)))
    .limit(1)
  return rows[0] ?? null
}

async function findTradesForReplay(
  executor: Executor,
  accountId: string,
  instrumentId: string
): Promise<TradeRow[]> {
  return executor
    .select()
    .from(trades)
    .where(
      and(
        eq(trades.accountId, accountId),
        eq(trades.instrumentId, instrumentId)
      )
    )
    .orderBy(asc(trades.date), asc(trades.createdAt))
}

async function insertTrade(
  executor: Executor,
  data: {
    organizationId: string
    accountId: string
    instrumentId: string
    type: string
    quantity: number | null
    price: number | null
    amount: number
    fees: number
    withheldTax?: number | null
    date: Date
    externalSource?: string | null
    externalId?: string | null
    externalMetadata?: Record<string, unknown> | null
  }
): Promise<TradeRow> {
  const [row] = await executor.insert(trades).values(data).returning()
  return row
}

async function updateTradeRow(
  executor: Executor,
  id: string,
  organizationId: string,
  data: {
    quantity?: number | null
    price?: number | null
    amount?: number
    fees?: number
    date?: Date
    instrumentId?: string
  }
): Promise<TradeRow> {
  const [row] = await executor
    .update(trades)
    .set(data)
    .where(and(eq(trades.id, id), eq(trades.organizationId, organizationId)))
    .returning()
  return row
}

async function deleteTradeRow(
  executor: Executor,
  id: string,
  organizationId: string
): Promise<void> {
  await executor
    .delete(trades)
    .where(and(eq(trades.id, id), eq(trades.organizationId, organizationId)))
}

async function findExistingExternalIds(
  accountId: string,
  externalSource: string,
  externalIds: string[]
): Promise<Set<string>> {
  if (externalIds.length === 0) return new Set()
  const rows = await db
    .select({ externalId: trades.externalId })
    .from(trades)
    .where(
      and(
        eq(trades.accountId, accountId),
        eq(trades.externalSource, externalSource),
        inArray(trades.externalId, externalIds)
      )
    )
  return new Set(
    rows.map((r) => r.externalId).filter((v): v is string => v !== null)
  )
}

async function takeAdvisoryLock(
  tx: Tx,
  accountId: string,
  instrumentId: string
): Promise<void> {
  await tx.execute(sql`
    SELECT pg_advisory_xact_lock(
      hashtext(${accountId})::bigint << 32 |
      (hashtext(${instrumentId})::bigint & x'FFFFFFFF'::bigint)
    )
  `)
}

function rowsToReplayTrades(rows: TradeRow[]): ReplayTrade[] {
  return rows.map((t) => ({
    type: t.type as "buy" | "sell" | "dividend",
    quantity: t.quantity,
    price: t.price,
    fees: t.fees,
    date: t.date,
    createdAt: t.createdAt,
  }))
}

// ---------- Public API ----------

export interface CreateTradeInput {
  organizationId: string
  accountId: string
  symbol: string
  type: "buy" | "sell" | "dividend"
  quantity?: number
  price?: number
  amount?: number
  fees?: number
  withheldTax?: number
  date: Date
  externalSource?: string
  externalId?: string
  externalMetadata?: Record<string, unknown>
}

export async function createTrade(input: CreateTradeInput): Promise<Trade> {
  if (input.date.getTime() > Date.now()) {
    throw new HTTPException(400, {
      message: "Future-dated trades are not allowed",
    })
  }

  const [accountRow] = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.id, input.accountId),
        eq(accounts.organizationId, input.organizationId)
      )
    )
    .limit(1)
  if (!accountRow)
    throw new HTTPException(404, { message: "Account not found" })
  if (accountRow.type !== "brokerage") {
    throw new HTTPException(400, {
      message: "Trades require a brokerage-type account",
    })
  }

  const instrument = await ensureInstrumentBySymbol(input.symbol)

  const fees = input.fees ?? 0
  const withheldTax = input.withheldTax ?? 0
  let quantity: number | null
  let price: number | null
  let amount: number

  if (input.type === "buy" || input.type === "sell") {
    if (input.quantity == null || input.price == null) {
      throw new HTTPException(400, {
        message: "Buy/sell requires quantity and price",
      })
    }
    if (instrument.currency !== accountRow.currency) {
      throw new HTTPException(400, {
        message: `Instrument currency (${instrument.currency}) does not match account currency (${accountRow.currency})`,
      })
    }
    quantity = input.quantity
    price = input.price
    const gross = input.quantity * input.price
    amount = input.type === "buy" ? gross + fees : gross - fees
  } else {
    if (input.amount == null) {
      throw new HTTPException(400, { message: "Dividend requires amount" })
    }
    quantity = null
    price = null
    amount = input.amount
  }

  return db.transaction(async (tx) => {
    await takeAdvisoryLock(tx, input.accountId, instrument.id)

    if (input.type === "sell") {
      const existing = await findTradesForReplay(
        tx,
        input.accountId,
        instrument.id
      )
      const proposed: ReplayTrade = {
        type: "sell",
        quantity,
        price,
        fees,
        date: input.date,
        createdAt: new Date(),
      }
      assertNonNegative([...rowsToReplayTrades(existing), proposed])
    }

    const tradeRow = await insertTrade(tx, {
      organizationId: input.organizationId,
      accountId: input.accountId,
      instrumentId: instrument.id,
      type: input.type,
      quantity,
      price,
      amount,
      fees,
      withheldTax: input.type === "dividend" ? withheldTax : null,
      date: input.date,
      externalSource: input.externalSource ?? null,
      externalId: input.externalId ?? null,
      externalMetadata: input.externalMetadata ?? null,
    })

    return toTradeResponse(tradeRow, instrument.symbol)
  })
}

export interface UpdateTradeInput {
  id: string
  organizationId: string
  symbol?: string
  quantity?: number
  price?: number
  amount?: number
  fees?: number
  date?: Date
}

export async function updateTrade(input: UpdateTradeInput): Promise<Trade> {
  if (input.date && input.date.getTime() > Date.now()) {
    throw new HTTPException(400, {
      message: "Future-dated trades are not allowed",
    })
  }

  const existing = await findTradeById(input.id, input.organizationId)
  if (!existing) throw new HTTPException(404, { message: "Trade not found" })

  let instrumentId = existing.instrumentId
  let instrumentCurrency: string | null = null
  if (input.symbol) {
    const inst = await ensureInstrumentBySymbol(input.symbol)
    instrumentId = inst.id
    instrumentCurrency = inst.currency
  }

  const type = existing.type as "buy" | "sell" | "dividend"
  const fees = input.fees ?? existing.fees
  const date = input.date ?? existing.date
  let quantity = existing.quantity
  let price = existing.price
  let amount = existing.amount

  if (type === "buy" || type === "sell") {
    quantity = input.quantity ?? existing.quantity
    price = input.price ?? existing.price
    if (quantity == null || price == null) {
      throw new HTTPException(400, {
        message: "Buy/sell requires quantity and price",
      })
    }
    const gross = quantity * price
    amount = type === "buy" ? gross + fees : gross - fees
  } else {
    amount = input.amount ?? existing.amount
  }

  if (instrumentCurrency) {
    const [accountRow] = await db
      .select({ currency: accounts.currency })
      .from(accounts)
      .where(eq(accounts.id, existing.accountId))
      .limit(1)
    if (!accountRow)
      throw new HTTPException(404, { message: "Account not found" })
    if (instrumentCurrency !== accountRow.currency) {
      throw new HTTPException(400, {
        message: `Instrument currency (${instrumentCurrency}) does not match account currency (${accountRow.currency})`,
      })
    }
  }

  return db.transaction(async (tx) => {
    const keys = Array.from(
      new Set([existing.instrumentId, instrumentId])
    ).sort()
    for (const iid of keys) {
      await takeAdvisoryLock(tx, existing.accountId, iid)
    }

    const updated = await updateTradeRow(tx, input.id, input.organizationId, {
      instrumentId,
      quantity: type === "dividend" ? null : quantity,
      price: type === "dividend" ? null : price,
      amount,
      fees,
      date,
    })

    for (const iid of keys) {
      const tradesForReplay = await findTradesForReplay(
        tx,
        existing.accountId,
        iid
      )
      assertNonNegative(rowsToReplayTrades(tradesForReplay))
    }

    const [newInst] = await tx
      .select({ symbol: instruments.symbol })
      .from(instruments)
      .where(eq(instruments.id, instrumentId))
      .limit(1)

    return toTradeResponse(updated, newInst?.symbol ?? "")
  })
}

export async function deleteTrade(
  id: string,
  organizationId: string
): Promise<void> {
  const existing = await findTradeById(id, organizationId)
  if (!existing) throw new HTTPException(404, { message: "Trade not found" })

  await db.transaction(async (tx) => {
    await takeAdvisoryLock(tx, existing.accountId, existing.instrumentId)

    await deleteTradeRow(tx, id, organizationId)

    const remaining = await findTradesForReplay(
      tx,
      existing.accountId,
      existing.instrumentId
    )
    assertNonNegative(rowsToReplayTrades(remaining))
  })
}

export interface ListTradesFilters {
  organizationId: string
  accountId?: string
  symbol?: string
  type?: string
  from?: Date
  to?: Date
}

export async function listTrades(filters: ListTradesFilters): Promise<Trade[]> {
  const conditions: SQL[] = [eq(trades.organizationId, filters.organizationId)]
  if (filters.accountId)
    conditions.push(eq(trades.accountId, filters.accountId))
  if (filters.type) conditions.push(eq(trades.type, filters.type))
  if (filters.from) conditions.push(gte(trades.date, filters.from))
  if (filters.to) conditions.push(lte(trades.date, filters.to))

  if (filters.symbol) {
    const matching = await db
      .select({ id: instruments.id })
      .from(instruments)
      .where(eq(instruments.symbol, filters.symbol.toUpperCase()))
    const instrumentIds = matching.map((r) => r.id)
    if (instrumentIds.length === 0) return []
    conditions.push(inArray(trades.instrumentId, instrumentIds))
  }

  const rows = await db
    .select({
      id: trades.id,
      organizationId: trades.organizationId,
      accountId: trades.accountId,
      instrumentId: trades.instrumentId,
      type: trades.type,
      quantity: trades.quantity,
      price: trades.price,
      amount: trades.amount,
      fees: trades.fees,
      withheldTax: trades.withheldTax,
      date: trades.date,
      externalSource: trades.externalSource,
      externalId: trades.externalId,
      externalMetadata: trades.externalMetadata,
      createdAt: trades.createdAt,
      symbol: instruments.symbol,
    })
    .from(trades)
    .leftJoin(instruments, eq(instruments.id, trades.instrumentId))
    .where(and(...conditions))
    .orderBy(desc(trades.date), desc(trades.createdAt))

  return rows.map((r) =>
    toTradeResponse({ ...r, symbol: r.symbol ?? "" } as TradeWithSymbol)
  )
}

// ---------- IBKR Import ----------

export interface ImportTradesInput {
  organizationId: string
  accountId: string
  fileBuffer: Buffer
  dryRun: boolean
}

export async function importTrades(
  input: ImportTradesInput
): Promise<ImportTradesResponse> {
  const [accountRow] = await db
    .select()
    .from(accounts)
    .where(
      and(
        eq(accounts.id, input.accountId),
        eq(accounts.organizationId, input.organizationId)
      )
    )
    .limit(1)
  if (!accountRow)
    throw new HTTPException(404, { message: "Account not found" })
  if (accountRow.type !== "brokerage") {
    throw new HTTPException(400, {
      message: "Selected account must be a brokerage",
    })
  }

  let parsed: ParsedImport
  try {
    parsed = parseIbkrCsv(input.fileBuffer.toString("utf8"))
  } catch (err) {
    throw new HTTPException(400, {
      message: `Unrecognized CSV format — expected IBKR Activity Flex Query: ${(err as Error).message}`,
    })
  }

  // Intra-batch dedup for trades: the user may upload overlapping files
  // (e.g., a full-year export plus a partial re-export). Keep only the first
  // occurrence of each externalId so the partial unique index on `trades`
  // doesn't trip on the second insert in the commit loop. Deposits don't
  // dedup — they bump initial_balance and re-import is user-beware.
  const seenEventIds = new Set<string>()
  parsed = {
    ...parsed,
    events: parsed.events.filter((ev) => {
      if (seenEventIds.has(ev.externalId)) return false
      seenEventIds.add(ev.externalId)
      return true
    }),
  }

  // If events come from multiple IBKR accounts, don't auto-bind the Penny Duck
  // account to any single ClientAccountID. Only auto-set when the batch is
  // unambiguous (all events share one ClientAccountID).
  const distinctIbkrAccounts = new Set(
    parsed.events
      .map((e) => e.externalMetadata.clientAccountId)
      .filter((v): v is string => v !== null && v !== "")
  )
  const singleIbkrAccount =
    distinctIbkrAccounts.size === 1
      ? (distinctIbkrAccounts.values().next().value ?? null)
      : null

  const externalIds = parsed.events.map((e) => e.externalId)
  const existing = await findExistingExternalIds(
    input.accountId,
    EXTERNAL_SOURCE,
    externalIds
  )

  const rows = buildPreviewRows(parsed, existing, accountRow.currency)
  const summary = buildSummary(parsed, existing, rows)
  const parseErrors = parsed.errors.map((e) => ({
    line: e.line,
    reason: e.reason,
  }))

  if (input.dryRun) {
    return { summary, rows, parseErrors, committed: false, createdCount: 0 }
  }

  // Commit path
  if (summary.rowErrors > 0) {
    throw new HTTPException(400, {
      message: "Cannot import with row errors — fix the CSV and re-upload",
    })
  }

  const toCreate = parsed.events.filter((ev) => !existing.has(ev.externalId))

  // Pre-warm instruments: move the only realistic mid-loop failure
  // (Yahoo rate-limit on a new symbol) to a point where nothing has been written.
  const uniqueSymbols = Array.from(new Set(toCreate.map((ev) => ev.symbol)))
  for (const symbol of uniqueSymbols) {
    try {
      await ensureInstrumentBySymbol(symbol)
    } catch (err) {
      throw new HTTPException(400, {
        message: `Could not resolve symbol ${symbol}: ${(err as Error).message}`,
      })
    }
  }

  // Per-trade transaction (each call takes its own advisory lock on
  // (accountId, instrumentId)). Don't batch into one transaction — that would
  // hold many locks at once and serialize the whole org.
  let createdCount = 0
  for (const ev of toCreate) {
    await createTrade(toCreateTradeInput(ev, input))
    createdCount++
  }

  // Deposits/withdrawals shift the brokerage account's "starting state" — we
  // fold them straight into initial_balance instead of writing them as
  // discrete transactions. Re-importing the same CSV will double-bump; the
  // user can correct initial_balance manually if needed.
  const depositsTotal = parsed.deposits.reduce((s, d) => s + d.amount, 0)
  if (depositsTotal !== 0) {
    const depositsTotalCents = Math.round(depositsTotal * 100)
    await db
      .update(accounts)
      .set({
        initialBalance: sql`${accounts.initialBalance} + ${depositsTotalCents}`,
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, input.accountId))
  }

  if (singleIbkrAccount && accountRow.externalAccountId !== singleIbkrAccount) {
    await db
      .update(accounts)
      .set({ externalAccountId: singleIbkrAccount, updatedAt: new Date() })
      .where(eq(accounts.id, input.accountId))
  }

  return { summary, rows, parseErrors, committed: true, createdCount }
}

function toCreateTradeInput(
  ev: ParsedEvent,
  input: ImportTradesInput
): CreateTradeInput {
  if (ev.kind === "dividend") {
    return {
      organizationId: input.organizationId,
      accountId: input.accountId,
      symbol: ev.symbol,
      type: "dividend",
      amount: ev.amount,
      withheldTax: ev.withheldTax,
      date: ev.date,
      externalSource: ev.externalSource,
      externalId: ev.externalId,
      externalMetadata: ev.externalMetadata as unknown as Record<
        string,
        unknown
      >,
    }
  }
  return {
    organizationId: input.organizationId,
    accountId: input.accountId,
    symbol: ev.symbol,
    type: ev.kind,
    quantity: ev.quantity,
    price: ev.price,
    fees: ev.fees,
    date: ev.date,
    externalSource: ev.externalSource,
    externalId: ev.externalId,
    externalMetadata: ev.externalMetadata as unknown as Record<string, unknown>,
  }
}

function buildPreviewRows(
  parsed: ParsedImport,
  existing: Set<string>,
  accountCurrency: string
): ImportTradesRow[] {
  return parsed.events.map((ev): ImportTradesRow => {
    let status: "new" | "duplicate" | "error" = "new"
    let errorMessage: string | null = null
    if (existing.has(ev.externalId)) status = "duplicate"
    if (ev.currency !== accountCurrency) {
      status = "error"
      errorMessage = `Row currency ${ev.currency} does not match account currency ${accountCurrency}`
    }
    return {
      kind: ev.kind,
      symbol: ev.symbol,
      date: ev.date.toISOString(),
      quantity: ev.kind === "dividend" ? null : ev.quantity,
      price: ev.kind === "dividend" ? null : ev.price,
      amount: ev.kind === "dividend" ? ev.amount : ev.quantity * ev.price,
      withheldTax: ev.kind === "dividend" ? ev.withheldTax : null,
      fees: ev.kind === "dividend" ? 0 : ev.fees,
      externalId: ev.externalId,
      status,
      errorMessage,
    }
  })
}

function buildSummary(
  parsed: ParsedImport,
  existing: Set<string>,
  rows: ImportTradesRow[]
): ImportTradesSummary {
  const tradeEvents = parsed.events.filter((e) => e.kind !== "dividend")
  const dividends = parsed.events.filter((e) => e.kind === "dividend")
  return {
    clientAccountId: parsed.clientAccountId,
    tradesFound: tradeEvents.length,
    tradesToCreate: tradeEvents.filter((t) => !existing.has(t.externalId))
      .length,
    tradesSkippedAsDuplicate: tradeEvents.filter((t) =>
      existing.has(t.externalId)
    ).length,
    dividendsFound: dividends.length,
    dividendsToCreate: dividends.filter((d) => !existing.has(d.externalId))
      .length,
    dividendsSkippedAsDuplicate: dividends.filter((d) =>
      existing.has(d.externalId)
    ).length,
    depositsFound: parsed.deposits.length,
    depositsTotalAmount: parsed.deposits.reduce((s, d) => s + d.amount, 0),
    rowErrors:
      parsed.errors.length + rows.filter((r) => r.status === "error").length,
  }
}
