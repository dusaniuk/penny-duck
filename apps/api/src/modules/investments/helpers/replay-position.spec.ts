import { describe, it, expect } from "bun:test"
import { replayPosition, type ReplayTrade } from "./replay-position"

function mkTrade(overrides: Partial<ReplayTrade> & { type: ReplayTrade["type"] }): ReplayTrade {
  return {
    type: overrides.type,
    quantity: overrides.quantity ?? null,
    price: overrides.price ?? null,
    fees: overrides.fees ?? 0,
    date: overrides.date ?? new Date("2026-01-01T00:00:00Z"),
    createdAt: overrides.createdAt ?? new Date("2026-01-01T00:00:00Z"),
  }
}

describe("replayPosition", () => {
  it("single buy sets quantity and average cost", () => {
    const r = replayPosition([mkTrade({ type: "buy", quantity: 10, price: 150 })])
    expect(r.quantity).toBe(10)
    expect(r.averageCost).toBeCloseTo(150, 6)
    expect(r.realizedGain).toBe(0)
  })

  it("two buys average correctly", () => {
    const r = replayPosition([
      mkTrade({ type: "buy", quantity: 5, price: 140, date: new Date("2026-01-01T00:00:00Z") }),
      mkTrade({ type: "buy", quantity: 5, price: 160, date: new Date("2026-01-02T00:00:00Z") }),
    ])
    expect(r.quantity).toBe(10)
    expect(r.averageCost).toBeCloseTo(150, 6)
  })

  it("buy then sell realizes gain and preserves basis", () => {
    const r = replayPosition([
      mkTrade({ type: "buy", quantity: 10, price: 150, date: new Date("2026-01-01T00:00:00Z") }),
      mkTrade({ type: "sell", quantity: 4, price: 200, date: new Date("2026-01-02T00:00:00Z") }),
    ])
    expect(r.quantity).toBe(6)
    expect(r.averageCost).toBeCloseTo(150, 6)
    expect(r.realizedGain).toBeCloseTo((200 - 150) * 4, 6)
  })

  it("sell-all then buy-again resets basis but preserves realized gain", () => {
    const r = replayPosition([
      mkTrade({ type: "buy", quantity: 10, price: 100, date: new Date("2026-01-01T00:00:00Z") }),
      mkTrade({ type: "sell", quantity: 10, price: 120, date: new Date("2026-01-02T00:00:00Z") }),
      mkTrade({ type: "buy", quantity: 5, price: 130, date: new Date("2026-01-03T00:00:00Z") }),
    ])
    expect(r.quantity).toBe(5)
    expect(r.averageCost).toBeCloseTo(130, 6)
    expect(r.realizedGain).toBeCloseTo(200, 6)
  })

  it("dividend does not affect quantity or basis", () => {
    const r = replayPosition([
      mkTrade({ type: "buy", quantity: 10, price: 100 }),
      mkTrade({ type: "dividend" }),
    ])
    expect(r.quantity).toBe(10)
    expect(r.averageCost).toBeCloseTo(100, 6)
    expect(r.realizedGain).toBe(0)
  })

  it("out-of-order input is sorted by date then createdAt", () => {
    const laterBuy = mkTrade({
      type: "buy",
      quantity: 5,
      price: 160,
      date: new Date("2026-01-02T00:00:00Z"),
    })
    const earlierBuy = mkTrade({
      type: "buy",
      quantity: 5,
      price: 140,
      date: new Date("2026-01-01T00:00:00Z"),
    })
    const r = replayPosition([laterBuy, earlierBuy])
    expect(r.averageCost).toBeCloseTo(150, 6)
  })

  it("fees on buy add to basis, fees on sell subtract from realized", () => {
    const r = replayPosition([
      mkTrade({ type: "buy", quantity: 10, price: 100, fees: 10, date: new Date("2026-01-01T00:00:00Z") }),
      mkTrade({ type: "sell", quantity: 5, price: 120, fees: 5, date: new Date("2026-01-02T00:00:00Z") }),
    ])
    expect(r.averageCost).toBeCloseTo(101, 6)
    expect(r.realizedGain).toBeCloseTo(90, 6)
    expect(r.quantity).toBe(5)
  })

  it("empty trade list returns zeroed state", () => {
    const r = replayPosition([])
    expect(r.quantity).toBe(0)
    expect(r.averageCost).toBe(0)
    expect(r.realizedGain).toBe(0)
  })

  it("sell exceeding held quantity produces negative state for caller to reject", () => {
    const r = replayPosition([
      mkTrade({ type: "buy", quantity: 3, price: 100 }),
      mkTrade({ type: "sell", quantity: 5, price: 150, date: new Date("2026-01-02T00:00:00Z") }),
    ])
    expect(r.quantity).toBe(-2)
    // Realized gain still accrues for the portion where basis exists;
    // caller is responsible for treating negative quantity as invalid.
    expect(Number.isFinite(r.realizedGain)).toBe(true)
  })

  it("sell with no prior buys leaves quantity negative and finite numbers", () => {
    const r = replayPosition([mkTrade({ type: "sell", quantity: 5, price: 150 })])
    expect(r.quantity).toBe(-5)
    expect(Number.isFinite(r.averageCost)).toBe(true)
    expect(Number.isFinite(r.realizedGain)).toBe(true)
  })
})
