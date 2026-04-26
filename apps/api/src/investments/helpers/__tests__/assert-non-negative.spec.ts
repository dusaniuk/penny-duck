import { describe, it, expect } from "vitest"
import { ConflictException } from "@nestjs/common"
import { assertNonNegative } from "../assert-non-negative"
import type { ReplayTrade } from "../replay-position"

const buy = (qty: number, price = 100, date = "2026-01-01"): ReplayTrade => ({
  type: "buy",
  quantity: qty,
  price,
  fees: 0,
  date: new Date(date),
  createdAt: new Date(date),
})
const sell = (qty: number, price = 100, date = "2026-02-01"): ReplayTrade => ({
  type: "sell",
  quantity: qty,
  price,
  fees: 0,
  date: new Date(date),
  createdAt: new Date(date),
})

describe("assertNonNegative", () => {
  it("passes for empty trades", () => {
    expect(() => assertNonNegative([])).not.toThrow()
  })

  it("passes when all sells have prior coverage", () => {
    expect(() => assertNonNegative([buy(10), sell(5), sell(5)])).not.toThrow()
  })

  it("throws when a sell would exceed running quantity", () => {
    expect(() => assertNonNegative([buy(10), sell(11)])).toThrow(ConflictException)
  })

  it("throws on running quantity going negative mid-sequence even if final is non-negative", () => {
    // Sell-before-buy pattern; date order matters and replay sorts by date.
    expect(() =>
      assertNonNegative([
        sell(5, 100, "2026-02-01"),
        buy(10, 100, "2026-03-01"),
      ])
    ).toThrow(ConflictException)
  })
})
