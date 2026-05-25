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
    walletId: null,
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
    ...over,
  }
}

describe("buildNetWorthBreakdown", () => {
  it("shows a group row when it has accounts, even at zero balance", () => {
    const { rows } = buildNetWorthBreakdown(
      [account({ type: "bank", homeBalance: 0 })],
      []
    )
    expect(rows.map((r) => r.type)).toEqual(["bank"])
    expect(rows[0].value).toBe(0)
  })

  it("shows a group row when its net balance is negative", () => {
    const { rows } = buildNetWorthBreakdown(
      [account({ type: "brokerage", homeBalance: -500 })],
      []
    )
    expect(rows.map((r) => r.type)).toEqual(["brokerage"])
    expect(rows[0].value).toBe(-500)
  })

  it("omits a group with no entities", () => {
    const { rows } = buildNetWorthBreakdown(
      [account({ type: "bank", homeBalance: 100 })],
      []
    )
    expect(rows.map((r) => r.type)).toEqual(["bank"])
  })

  it("counts each wallet once and sums totals, currencies, and entities", () => {
    const result = buildNetWorthBreakdown(
      [account({ type: "bank", currency: "UAH", homeBalance: 1000 })],
      [
        wallet({
          totalHomeBalance: 300,
          pockets: [
            { accountId: "p1", currency: "USD", balance: 5, homeBalance: 200 },
            { accountId: "p2", currency: "EUR", balance: 2, homeBalance: 100 },
          ],
        }),
      ]
    )
    expect(result.total).toBe(1300)
    expect(result.totalEntities).toBe(2)
    expect(result.currencyCount).toBe(3) // UAH, USD, EUR
    const wRow = result.rows.find((r) => r.type === "wallet")!
    expect(wRow.value).toBe(300)
    expect(wRow.pct).toBeCloseTo((300 / 1300) * 100, 5)
  })

  it("orders rows bank, brokerage, wallet", () => {
    const { rows } = buildNetWorthBreakdown(
      [
        account({ type: "brokerage", homeBalance: 1 }),
        account({ type: "bank", homeBalance: 1 }),
      ],
      [wallet({ totalHomeBalance: 1 })]
    )
    expect(rows.map((r) => r.type)).toEqual(["bank", "brokerage", "wallet"])
  })
})
