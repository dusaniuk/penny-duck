import { type Trade, type Position } from "@workspace/api-contract"
import { type instruments, type trades } from "@workspace/db"
import { type PositionState } from "./replay-position"

export type TradeRow = typeof trades.$inferSelect
export type TradeWithSymbol = TradeRow & { symbol: string }
export type InstrumentRow = typeof instruments.$inferSelect

export function toTradeResponse(
  row: TradeRow | TradeWithSymbol,
  symbolOverride?: string
): Trade {
  const symbol = "symbol" in row ? row.symbol : (symbolOverride ?? "")
  return {
    id: row.id,
    accountId: row.accountId,
    instrumentId: row.instrumentId,
    symbol,
    type: row.type as Trade["type"],
    quantity: row.quantity ?? null,
    price: row.price ?? null,
    amount: row.amount,
    fees: row.fees,
    withheldTax: row.withheldTax ?? null,
    date: row.date.toISOString(),
    externalSource: row.externalSource ?? null,
    externalId: row.externalId ?? null,
    externalMetadata: (row.externalMetadata ?? null) as Record<
      string,
      unknown
    > | null,
    createdAt: row.createdAt.toISOString(),
  }
}

export function toPositionResponse(
  state: PositionState,
  instrument: InstrumentRow,
  accountId: string,
  homeRate: number
): Position {
  const currentPrice = instrument.lastPrice
  const currentValue = state.quantity * currentPrice
  const costBasis = state.quantity * state.averageCost
  const unrealizedGain = currentValue - costBasis
  const unrealizedGainPct =
    costBasis > 0 ? (unrealizedGain / costBasis) * 100 : 0
  return {
    accountId,
    symbol: instrument.symbol,
    name: instrument.name,
    currency: instrument.currency,
    quantity: state.quantity,
    averageCost: state.averageCost,
    currentPrice,
    currentValue,
    unrealizedGain,
    unrealizedGainPct,
    realizedGain: state.realizedGain,
    homeCurrentValue: currentValue * homeRate,
    homeUnrealizedGain: unrealizedGain * homeRate,
  }
}
