import { replayPosition, type ReplayTrade } from "./replay-position"

export type TradeWithInstrument = ReplayTrade & { instrumentId: string }

export function countOpenPositionsFromTrades(
  trades: TradeWithInstrument[]
): number {
  const byInstrument = new Map<string, ReplayTrade[]>()
  for (const t of trades) {
    const list = byInstrument.get(t.instrumentId) ?? []
    list.push(t)
    byInstrument.set(t.instrumentId, list)
  }
  let count = 0
  for (const list of byInstrument.values()) {
    if (replayPosition(list).quantity !== 0) count++
  }
  return count
}
