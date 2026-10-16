import { describe, expect, it } from "vitest"
import { buildNetWorthBreakdown } from "./net-worth-breakdown"
import type { Account, Wallet } from "@workspace/api-contract"

function account(over: Partial<Account>): Account {
  return {
    id: crypto.randomUUID(),
    name: "Acc",
    type: "bank",
    currency: "UAH",
    color: null,
    icon: null,
    balance: 0,
    homeBalance: 0,
    isDefault: false,
    cardLabel: null,
    walletId: null,
    archivedAt: null,
    ...over,
  }
}

function wallet(over: Partial<Wallet>): Wallet {
  return {
    id: crypto.randomUUID(),
    type: "wallet",
    name: "Wallet",
    color: null,
    icon: null,
    totalHomeBalance: 0,
    pockets: [],
    archivedAt: null,
    ...over,
  }
}

describe("buildNetWorthBreakdown — assets", () => {
  it("shows an asset group row when it has accounts, even at zero balance", () => {
    const { assets } = buildNetWorthBreakdown(
      [account({ type: "bank", homeBalance: 0 })],
      []
    )
    expect(assets.rows.map((r) => r.type)).toEqual(["bank"])
    expect(assets.rows[0].value).toBe(0)
  })

  it("shows an asset group row when its net balance is negative (brokerage drawdown)", () => {
    const { assets } = buildNetWorthBreakdown(
      [account({ type: "brokerage", homeBalance: -500 })],
      []
    )
    expect(assets.rows.map((r) => r.type)).toEqual(["brokerage"])
    expect(assets.rows[0].value).toBe(-500)
  })

  it("omits an asset group with no entities", () => {
    const { assets } = buildNetWorthBreakdown(
      [account({ type: "bank", homeBalance: 100 })],
      []
    )
    expect(assets.rows.map((r) => r.type)).toEqual(["bank"])
  })

  it("orders asset rows bank, brokerage, wallet", () => {
    const { assets } = buildNetWorthBreakdown(
      [
        account({ type: "brokerage", homeBalance: 1 }),
        account({ type: "bank", homeBalance: 1 }),
      ],
      [wallet({ totalHomeBalance: 1 })]
    )
    expect(assets.rows.map((r) => r.type)).toEqual([
      "bank",
      "brokerage",
      "wallet",
    ])
  })
})

describe("buildNetWorthBreakdown — liabilities and net", () => {
  it("groups loans into liabilities and reports their value as positive (owed amount)", () => {
    const { liabilities } = buildNetWorthBreakdown(
      [account({ type: "loan", homeBalance: -20_000 })],
      []
    )
    expect(liabilities.rows.map((r) => r.type)).toEqual(["loan"])
    expect(liabilities.rows[0].value).toBe(20_000)
    expect(liabilities.total).toBe(20_000)
  })

  it("sums multiple loans into the liabilities total", () => {
    const { liabilities } = buildNetWorthBreakdown(
      [
        account({ type: "loan", homeBalance: -10_000 }),
        account({ type: "loan", homeBalance: -5_000 }),
      ],
      []
    )
    expect(liabilities.total).toBe(15_000)
    expect(liabilities.rows).toHaveLength(1)
    expect(liabilities.rows[0].value).toBe(15_000)
  })

  it("computes net = assets.total - liabilities.total", () => {
    const { assets, liabilities, net } = buildNetWorthBreakdown(
      [
        account({ type: "bank", homeBalance: 18_000 }),
        account({ type: "brokerage", homeBalance: 10_000 }),
        account({ type: "loan", homeBalance: -20_000 }),
      ],
      [wallet({ totalHomeBalance: 4_400 })]
    )
    expect(assets.total).toBe(32_400)
    expect(liabilities.total).toBe(20_000)
    expect(net).toBe(12_400)
  })

  it("returns empty liabilities (zero total, no rows) when no loans exist", () => {
    const { liabilities, net, assets } = buildNetWorthBreakdown(
      [account({ type: "bank", homeBalance: 100 })],
      []
    )
    expect(liabilities.total).toBe(0)
    expect(liabilities.rows).toEqual([])
    expect(net).toBe(assets.total)
  })

  it("counts loans toward totalEntities and currencyCount", () => {
    const result = buildNetWorthBreakdown(
      [
        account({ type: "bank", currency: "UAH", homeBalance: 1000 }),
        account({ type: "loan", currency: "USD", homeBalance: -500 }),
      ],
      []
    )
    expect(result.totalEntities).toBe(2)
    expect(result.currencyCount).toBe(2)
  })

  it("emits a liability row for a zero-balance loan account (paid off but still tracked)", () => {
    const result = buildNetWorthBreakdown(
      [account({ type: "loan", homeBalance: 0 })],
      []
    )
    expect(result.liabilities.rows).toHaveLength(1)
    expect(result.liabilities.rows[0].value).toBe(0)
    expect(result.liabilities.total).toBe(0)
    expect(result.totalEntities).toBe(1)
  })

  it("computes asset row pct relative to assets.total (not net)", () => {
    const { assets } = buildNetWorthBreakdown(
      [
        account({ type: "bank", homeBalance: 750 }),
        account({ type: "brokerage", homeBalance: 250 }),
        account({ type: "loan", homeBalance: -200 }),
      ],
      []
    )
    const bank = assets.rows.find((r) => r.type === "bank")!
    expect(bank.pct).toBeCloseTo(75, 5) // 750/1000, not 750/800
  })
})
