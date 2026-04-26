import { describe, it, expect } from "vitest"
import { countOpenPositionsFromTrades } from "../count-open-positions"
import type { ReplayTrade } from "../replay-position"

type T = ReplayTrade & { instrumentId: string }
const trade = (
  instrumentId: string,
  type: "buy" | "sell" | "dividend",
  quantity: number | null,
  date = "2026-01-01"
): T => ({
  instrumentId,
  type,
  quantity,
  price: 100,
  fees: 0,
  date: new Date(date),
  createdAt: new Date(date),
})

describe("countOpenPositionsFromTrades", () => {
  it("returns 0 for no trades", () => {
    expect(countOpenPositionsFromTrades([])).toBe(0)
  })

  it("counts each instrument with non-zero quantity", () => {
    const trades = [
      trade("inst-a", "buy", 10),
      trade("inst-b", "buy", 5),
    ]
    expect(countOpenPositionsFromTrades(trades)).toBe(2)
  })

  it("excludes instruments fully closed out", () => {
    const trades = [
      trade("inst-a", "buy", 10, "2026-01-01"),
      trade("inst-a", "sell", 10, "2026-02-01"),
      trade("inst-b", "buy", 5),
    ]
    expect(countOpenPositionsFromTrades(trades)).toBe(1)
  })

  it("ignores dividends (no quantity impact)", () => {
    const trades = [
      trade("inst-a", "buy", 10),
      trade("inst-a", "dividend", null),
    ]
    expect(countOpenPositionsFromTrades(trades)).toBe(1)
  })
})
