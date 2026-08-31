import { HTTPException } from "hono/http-exception"
import { and, asc, eq } from "drizzle-orm"
import {
  type InvestmentsSummary,
  type Position,
} from "@workspace/api-contract"
import { trades, users } from "@workspace/db"
import { db } from "@/db"
import { getRate } from "@/modules/exchange-rates/service"
import { toPositionResponse } from "../helpers/mappers"
import { replayPosition, type ReplayTrade } from "../helpers/replay-position"
import {
  findInstrumentBySymbol,
  findInstrumentsByIds,
  refreshIfStale,
} from "../instruments/service"

async function getHomeCurrency(userId: string): Promise<string> {
  const [row] = await db
    .select({ homeCurrency: users.homeCurrency })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  return row?.homeCurrency ?? "UAH"
}

export async function getPositions(
  organizationId: string,
  userId: string
): Promise<{ positions: Position[]; pricesStale: boolean }> {
  const allTrades = await db
    .select()
    .from(trades)
    .where(eq(trades.organizationId, organizationId))
    .orderBy(
      asc(trades.accountId),
      asc(trades.instrumentId),
      asc(trades.date),
      asc(trades.createdAt)
    )

  if (allTrades.length === 0) return { positions: [], pricesStale: false }

  const groups = new Map<
    string,
    { accountId: string; instrumentId: string; trades: ReplayTrade[] }
  >()
  for (const t of allTrades) {
    const key = `${t.accountId}:${t.instrumentId}`
    const replayTrade: ReplayTrade = {
      type: t.type as "buy" | "sell" | "dividend",
      quantity: t.quantity,
      price: t.price,
      fees: t.fees,
      date: t.date,
      createdAt: t.createdAt,
    }
    const existing = groups.get(key)
    if (existing) existing.trades.push(replayTrade)
    else
      groups.set(key, {
        accountId: t.accountId,
        instrumentId: t.instrumentId,
        trades: [replayTrade],
      })
  }

  const instrumentIds = [...new Set(allTrades.map((t) => t.instrumentId))]
  const instrumentRows = await findInstrumentsByIds(instrumentIds)
  const { refreshed, stale } = await refreshIfStale(instrumentRows)
  const byId = new Map(refreshed.map((r) => [r.id, r]))

  const homeCurrency = await getHomeCurrency(userId)
  const today = new Date()
  const currencies = [...new Set(refreshed.map((r) => r.currency))]
  const rates = new Map<string, number>()
  for (const cur of currencies) {
    rates.set(cur, await getRate(cur, homeCurrency, today, [cur, homeCurrency]))
  }

  const positions: Position[] = []
  for (const group of groups.values()) {
    const state = replayPosition(group.trades)
    if (state.quantity === 0 && state.realizedGain === 0) continue
    const inst = byId.get(group.instrumentId)
    if (!inst) continue
    positions.push(
      toPositionResponse(
        state,
        inst,
        group.accountId,
        rates.get(inst.currency) ?? 1
      )
    )
  }

  return { positions, pricesStale: stale }
}

export async function getPositionBySymbol(
  accountId: string,
  symbol: string,
  organizationId: string,
  userId: string
): Promise<Position> {
  const inst = await findInstrumentBySymbol(symbol.toUpperCase())
  if (!inst) throw new HTTPException(404, { message: "Instrument not found" })

  const tradeRows = await db
    .select()
    .from(trades)
    .where(
      and(
        eq(trades.organizationId, organizationId),
        eq(trades.accountId, accountId),
        eq(trades.instrumentId, inst.id)
      )
    )
    .orderBy(asc(trades.date), asc(trades.createdAt))
  if (tradeRows.length === 0) {
    throw new HTTPException(404, { message: "Position not found" })
  }

  const state = replayPosition(
    tradeRows.map((t) => ({
      type: t.type as "buy" | "sell" | "dividend",
      quantity: t.quantity,
      price: t.price,
      fees: t.fees,
      date: t.date,
      createdAt: t.createdAt,
    }))
  )

  const { refreshed } = await refreshIfStale([inst])
  const refreshedInst = refreshed[0] ?? inst

  const homeCurrency = await getHomeCurrency(userId)
  const rate = await getRate(
    refreshedInst.currency,
    homeCurrency,
    new Date(),
    [refreshedInst.currency, homeCurrency]
  )

  return toPositionResponse(state, refreshedInst, accountId, rate)
}

export async function getSummary(
  organizationId: string,
  userId: string
): Promise<InvestmentsSummary> {
  const { positions, pricesStale } = await getPositions(organizationId, userId)

  let totalValueHome = 0
  let totalCostHome = 0
  let totalUnrealizedGainHome = 0
  let totalRealizedGainHome = 0

  for (const p of positions) {
    // Derive the instrument → home FX rate implicit in the position response.
    const rate = p.currentValue > 0 ? p.homeCurrentValue / p.currentValue : 1
    totalValueHome += p.homeCurrentValue
    totalCostHome += p.quantity * p.averageCost * rate
    totalUnrealizedGainHome += p.homeUnrealizedGain
    totalRealizedGainHome += p.realizedGain * rate
  }

  return {
    totalValueHome,
    totalCostHome,
    totalUnrealizedGainHome,
    totalRealizedGainHome,
    positionsCount: positions.filter((p) => p.quantity > 0).length,
    pricesStale,
  }
}
