import { HTTPException } from "hono/http-exception"
import { eq, inArray, sql } from "drizzle-orm"
import { type Instrument } from "@workspace/api-contract"
import { instruments } from "@workspace/db"
import { db } from "@/hono/db"
import { type InstrumentRow } from "../helpers/mappers"
import { fetchQuotes, RateLimitedError, searchYahoo } from "./yahoo"

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
      console.warn("Yahoo rate-limited; serving stale prices")
    } else {
      console.warn(
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

export async function refreshAllPricesForOrg(
  organizationId: string
): Promise<{ refreshed: number }> {
  const referenced = await findAllReferenced(organizationId)
  const { refreshed, stale } = await refreshIfStale(referenced)
  return { refreshed: stale ? 0 : refreshed.length }
}
