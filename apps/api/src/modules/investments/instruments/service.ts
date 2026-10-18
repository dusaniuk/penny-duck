import { HTTPException } from "hono/http-exception"
import { desc, eq, inArray, sql } from "drizzle-orm"
import { type Instrument } from "@workspace/api-contract"
import { instrumentPrices, instruments } from "@workspace/db"
import { db } from "@/db"
import { logger } from "@/logger"
import { type InstrumentRow } from "../helpers/mappers"
import {
  fetchHistorical,
  fetchQuotes,
  RateLimitedError,
  searchYahoo,
} from "./yahoo"

const STALENESS_MS = 15 * 60 * 1000

export async function findInstrumentBySymbol(
  symbol: string
): Promise<InstrumentRow | null> {
  const rows = await db
    .select()
    .from(instruments)
    .where(eq(instruments.symbol, symbol.toUpperCase()))
    .limit(1)
  return rows[0] ?? null
}

export async function findInstrumentsByIds(
  ids: string[]
): Promise<InstrumentRow[]> {
  if (ids.length === 0) return []
  return db.select().from(instruments).where(inArray(instruments.id, ids))
}

export async function searchLocalInstruments(
  query: string,
  limit = 10
): Promise<InstrumentRow[]> {
  const like = `%${query}%`
  return db
    .select()
    .from(instruments)
    .where(
      sql`(${instruments.symbol} ILIKE ${like} OR ${instruments.name} ILIKE ${like})`
    )
    .limit(limit)
}

export async function upsertInstrument(data: {
  symbol: string
  name: string
  exchange: string | null
  currency: string
  lastPrice: number
  lastPricedAt: Date
}): Promise<InstrumentRow> {
  const [row] = await db
    .insert(instruments)
    .values({
      symbol: data.symbol.toUpperCase(),
      name: data.name,
      exchange: data.exchange,
      currency: data.currency,
      lastPrice: data.lastPrice,
      lastPricedAt: data.lastPricedAt,
    })
    .onConflictDoUpdate({
      target: instruments.symbol,
      set: {
        name: data.name,
        exchange: data.exchange,
        currency: data.currency,
        lastPrice: data.lastPrice,
        lastPricedAt: data.lastPricedAt,
        updatedAt: new Date(),
      },
    })
    .returning()
  return row
}

async function updateInstrumentPrice(
  id: string,
  price: number,
  at: Date
): Promise<void> {
  await db
    .update(instruments)
    .set({ lastPrice: price, lastPricedAt: at, updatedAt: new Date() })
    .where(eq(instruments.id, id))
}

async function findAllReferenced(
  organizationId: string
): Promise<InstrumentRow[]> {
  const rows = await db.execute(sql`
    SELECT DISTINCT i.*
    FROM app.instruments i
    JOIN app.trades t ON t.instrument_id = i.id
    WHERE t.organization_id = ${organizationId}
  `)
  return rows.rows as unknown as InstrumentRow[]
}

/** Look up by symbol, fetching from Yahoo if missing. Throws 404 if Yahoo returns nothing. */
export async function ensureInstrumentBySymbol(
  symbol: string
): Promise<InstrumentRow> {
  const upper = symbol.toUpperCase()
  const cached = await findInstrumentBySymbol(upper)
  if (cached) return cached

  const quotes = await fetchQuotes([upper])
  if (quotes.length === 0) {
    throw new HTTPException(404, { message: `Symbol ${upper} not found` })
  }
  const q = quotes[0]
  return upsertInstrument({
    symbol: q.symbol,
    name: q.name,
    exchange: q.exchange,
    currency: q.currency,
    lastPrice: q.price,
    lastPricedAt: new Date(),
  })
}

/**
 * Refreshes prices for any instruments whose `lastPricedAt` is older than the
 * staleness threshold. Returns the updated rows (falling back to cached values
 * if Yahoo didn't respond for that symbol) and a boolean indicating whether
 * any price ended up still stale. Never throws on Yahoo failure.
 */
export async function refreshIfStale(
  rows: InstrumentRow[]
): Promise<{ refreshed: InstrumentRow[]; stale: boolean }> {
  const now = Date.now()
  const staleRows = rows.filter(
    (r) => !r.lastPricedAt || now - r.lastPricedAt.getTime() > STALENESS_MS
  )
  if (staleRows.length === 0) return { refreshed: rows, stale: false }

  try {
    const quotes = await fetchQuotes(staleRows.map((r) => r.symbol))
    const priceBySymbol = new Map(quotes.map((q) => [q.symbol, q.price]))
    const refreshedAt = new Date()
    const updated: InstrumentRow[] = []
    for (const row of rows) {
      const newPrice = priceBySymbol.get(row.symbol)
      if (newPrice == null) {
        updated.push(row)
        continue
      }
      await updateInstrumentPrice(row.id, newPrice, refreshedAt)
      updated.push({ ...row, lastPrice: newPrice, lastPricedAt: refreshedAt })
    }
    const stillStale = updated.some(
      (r) => !r.lastPricedAt || now - r.lastPricedAt.getTime() > STALENESS_MS
    )
    return { refreshed: updated, stale: stillStale }
  } catch (err) {
    if (err instanceof RateLimitedError) {
      logger.warn("Yahoo rate-limited; serving stale prices")
    } else {
      logger.warn(
        `Yahoo fetch failed: ${(err as Error).message}; serving stale prices`
      )
    }
    return { refreshed: rows, stale: true }
  }
}

function toInstrumentResponse(r: InstrumentRow): Instrument {
  return {
    id: r.id,
    symbol: r.symbol,
    name: r.name,
    exchange: r.exchange,
    currency: r.currency,
    lastPrice: r.lastPrice,
    lastPricedAt: r.lastPricedAt?.toISOString() ?? null,
  }
}

export async function searchInstruments(q: string): Promise<Instrument[]> {
  const local = await searchLocalInstruments(q)
  if (local.length >= 5) {
    return local.map(toInstrumentResponse)
  }

  const remote = await searchYahoo(q).catch(() => [])
  const haveSymbols = new Set(local.map((r) => r.symbol.toUpperCase()))
  const merged: Instrument[] = local.map(toInstrumentResponse)
  for (const r of remote) {
    if (haveSymbols.has(r.symbol.toUpperCase())) continue
    merged.push({
      id: "",
      symbol: r.symbol.toUpperCase(),
      name: r.name,
      exchange: r.exchange,
      currency: "USD",
      lastPrice: 0,
      lastPricedAt: null,
    })
  }
  return merged.slice(0, 10)
}

export async function getInstrument(symbol: string): Promise<Instrument> {
  const inst = await ensureInstrumentBySymbol(symbol)
  const { refreshed } = await refreshIfStale([inst])
  return toInstrumentResponse(refreshed[0] ?? inst)
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000

function todayUTC(): Date {
  const now = new Date()
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  )
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

async function getLatestStoredDate(
  instrumentId: string
): Promise<string | null> {
  const rows = await db
    .select({ date: instrumentPrices.date })
    .from(instrumentPrices)
    .where(eq(instrumentPrices.instrumentId, instrumentId))
    .orderBy(desc(instrumentPrices.date))
    .limit(1)
  return rows[0]?.date ?? null
}

async function backfillOne(
  inst: InstrumentRow,
  days: number,
  today: Date
): Promise<void> {
  const windowStart = new Date(today.getTime() - (days - 1) * ONE_DAY_MS)
  const latest = await getLatestStoredDate(inst.id)
  // Fresh enough: stored date is today or yesterday. Skip.
  if (latest) {
    const yesterday = isoDate(new Date(today.getTime() - ONE_DAY_MS))
    if (latest >= yesterday) return
  }

  // Fetch from max(stored+1day, windowStart) to today.
  const fromDate = latest
    ? new Date(new Date(latest).getTime() + ONE_DAY_MS)
    : windowStart
  const period1 = fromDate < windowStart ? windowStart : fromDate
  // Yahoo's period2 is exclusive of the day; add one day to include today.
  const period2 = new Date(today.getTime() + ONE_DAY_MS)

  try {
    const points = await fetchHistorical(inst.symbol, period1, period2)
    if (points.length === 0) return
    await db
      .insert(instrumentPrices)
      .values(
        points.map((p) => ({
          instrumentId: inst.id,
          date: p.date,
          close: p.close,
        }))
      )
      .onConflictDoUpdate({
        target: [instrumentPrices.instrumentId, instrumentPrices.date],
        set: { close: sql`excluded.close` },
      })
  } catch (err) {
    if (err instanceof RateLimitedError) {
      logger.warn(`Yahoo rate-limited fetching history for ${inst.symbol}`)
    } else {
      logger.warn(
        `Yahoo chart failed for ${inst.symbol}: ${(err as Error).message}`
      )
    }
  }
}

export async function ensureHistoricalPrices(
  instrumentIds: string[],
  days: number
): Promise<void> {
  if (instrumentIds.length === 0) return
  const rows = await findInstrumentsByIds(instrumentIds)
  const today = todayUTC()
  await Promise.all(rows.map((row) => backfillOne(row, days, today)))
}

export async function refreshAllPricesForOrg(
  organizationId: string
): Promise<{ refreshed: number }> {
  const referenced = await findAllReferenced(organizationId)
  const { refreshed, stale } = await refreshIfStale(referenced)
  return { refreshed: stale ? 0 : refreshed.length }
}
