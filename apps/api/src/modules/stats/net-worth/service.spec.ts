import { describe, it, expect, beforeAll, afterAll, beforeEach } from "bun:test"
import { eq } from "drizzle-orm"
import { exchangeRates, users } from "@workspace/db"
import { db } from "@/db"
import { honoApp } from "@/app"
import { createAccount } from "@/modules/accounts/service"
import { createWallet } from "@/modules/wallets/service"
import { createTransaction } from "@/modules/transactions/service"
import { createCategory } from "@/modules/categories/service"
import {
  closeTestApp,
  createTestApp,
  signupUser,
  truncateAll,
} from "@/test/setup"

beforeAll(async () => {
  await createTestApp()
})
afterAll(() => closeTestApp())
beforeEach(() => truncateAll())

async function authed(): Promise<{
  cookie: string
  organizationId: string
  userId: string
}> {
  const result = await signupUser()
  await db
    .update(users)
    .set({ homeCurrency: "UAH" })
    .where(eq(users.id, result.userId))
  return {
    cookie: result.cookie,
    organizationId: result.organizationId,
    userId: result.userId,
  }
}

describe("GET /stats/net-worth", () => {
  it("returns 401 without a cookie", async () => {
    const res = await honoApp.request("/stats/net-worth")
    expect(res.status).toBe(401)
  })

  it("returns zeros for a new org and 13 history points", async () => {
    const { cookie } = await authed()
    const res = await honoApp.request("/stats/net-worth", {
      headers: { cookie },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.current.total).toBe(0)
    expect(body.current.cash).toBe(0)
    expect(body.current.investments).toBe(0)
    expect(body.current.homeCurrency).toBe("UAH")
    expect(body.current.accountsCount).toBe(0)
    expect(body.current.topAccounts).toEqual([])
    expect(body.history.points).toHaveLength(13)
    expect(
      body.history.points.every((p: { total: number }) => p.total === 0)
    ).toBe(true)
  })

  it("includes account balances in current.total and top-3 accounts", async () => {
    const { cookie, organizationId, userId } = await authed()
    await createAccount({
      organizationId,
      userId,
      name: "PKO",
      type: "bank",
      currency: "UAH",
      balance: 31240,
    })
    await createAccount({
      organizationId,
      userId,
      name: "Personal",
      type: "bank",
      currency: "UAH",
      balance: 12210,
    })
    await createAccount({
      organizationId,
      userId,
      name: "Revolut",
      type: "bank",
      currency: "UAH",
      balance: 3840,
    })
    await createAccount({
      organizationId,
      userId,
      name: "Tiny",
      type: "bank",
      currency: "UAH",
      balance: 10,
    })

    const res = await honoApp.request("/stats/net-worth", {
      headers: { cookie },
    })
    const body = await res.json()
    expect(body.current.cash).toBeCloseTo(31240 + 12210 + 3840 + 10, 2)
    expect(body.current.accountsCount).toBe(4)
    expect(body.current.topAccounts).toHaveLength(3)
    expect(body.current.topAccounts[0].name).toBe("PKO")
  })

  it("counts each wallet once and merges its pockets into a single top-accounts entry", async () => {
    const { cookie, organizationId, userId } = await authed()
    const today = new Date().toISOString().split("T")[0]
    await db.insert(exchangeRates).values([
      { date: today, base: "USD", target: "UAH", rate: 40 },
      { date: today, base: "EUR", target: "UAH", rate: 44 },
    ])
    await createAccount({
      organizationId,
      userId,
      name: "Bank",
      type: "bank",
      currency: "UAH",
      balance: 1000,
    })
    await createWallet({
      organizationId,
      userId,
      name: "Cash",
      pockets: [
        { currency: "USD", balance: 100 },
        { currency: "EUR", balance: 50 },
      ],
    })

    const res = await honoApp.request("/stats/net-worth", {
      headers: { cookie },
    })
    const body = await res.json()

    // 1 bank + 1 wallet — pockets must not each count as an account.
    expect(body.current.accountsCount).toBe(2)
    const cashEntries = body.current.topAccounts.filter(
      (a: { name: string }) => a.name === "Cash"
    )
    expect(cashEntries).toHaveLength(1)
    // 100 * 40 + 50 * 44 = 6200 in home currency.
    expect(cashEntries[0].homeBalance).toBeCloseTo(6200, 2)
    // Total still sums every pocket once: 1000 + 6200.
    expect(body.current.total).toBeCloseTo(7200, 2)
  })

  it("walks back history using monthly transaction deltas", async () => {
    const { cookie, organizationId, userId } = await authed()
    const account = await createAccount({
      organizationId,
      userId,
      name: "Bank",
      type: "bank",
      currency: "UAH",
      balance: 1000,
    })
    const category = await createCategory({
      organizationId,
      name: "Groceries",
      parentId: null,
      icon: "cart",
      type: "expense",
      color: "red",
    })
    const categoryId = category.id

    // Add a 500 income this month → current cash = 1500.
    await createTransaction({
      organizationId,
      accountId: account.id,
      type: "income",
      amount: 500,
      categoryId,
      date: new Date(),
      madeById: userId,
    })

    const res = await honoApp.request("/stats/net-worth", {
      headers: { cookie },
    })
    const body = await res.json()

    expect(body.current.total).toBeCloseTo(1500, 2)
    // 13 points: today's = 1500, all previous = 1000 (the income happened this month).
    expect(body.history.points).toHaveLength(13)
    expect(
      body.history.points[body.history.points.length - 1].total
    ).toBeCloseTo(1500, 2)
    // Earlier points should all equal 1000 because the only delta is in the current month.
    for (let i = 0; i < body.history.points.length - 1; i++) {
      expect(body.history.points[i].total).toBeCloseTo(1000, 2)
    }
  })
})
