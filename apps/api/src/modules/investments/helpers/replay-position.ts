export interface ReplayTrade {
  type: "buy" | "sell" | "dividend"
  quantity: number | null
  price: number | null
  fees: number
  date: Date
  createdAt: Date
}

export interface PositionState {
  quantity: number
  averageCost: number
  realizedGain: number
}

export function replayPosition(trades: ReplayTrade[]): PositionState {
  const sorted = [...trades].sort((a, b) => {
    const d = a.date.getTime() - b.date.getTime()
    if (d !== 0) return d
    return a.createdAt.getTime() - b.createdAt.getTime()
  })

  let quantity = 0
  let totalCost = 0
  let realizedGain = 0

  for (const trade of sorted) {
    if (trade.type === "buy") {
      if (trade.quantity == null || trade.price == null) continue
      quantity += trade.quantity
      totalCost += trade.quantity * trade.price + trade.fees
    } else if (trade.type === "sell") {
      if (trade.quantity == null || trade.price == null) continue
      const avg = quantity > 0 ? totalCost / quantity : 0
      realizedGain += (trade.price - avg) * trade.quantity - trade.fees
      totalCost -= avg * trade.quantity
      quantity -= trade.quantity
    }
    // dividend: no quantity / basis effect
  }

  const averageCost = quantity > 0 ? totalCost / quantity : 0
  return { quantity, averageCost, realizedGain }
}
