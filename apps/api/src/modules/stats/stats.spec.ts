import { describe, it, expect, beforeAll, beforeEach, afterAll } from "bun:test"
import { honoApp } from "@/app"
import { createAccount } from "@/modules/accounts/service"
import { createTransaction } from "@/modules/transactions/service"
import { createCategory } from "@/modules/categories/service"
import {
  closeTestApp,
  createTestApp,
  flushEvents,
  signupUser,
  truncateAll,
} from "@/test/setup"

beforeAll(async () => {
  await createTestApp()
})

afterAll(() => closeTestApp())
beforeEach(() => truncateAll())

async function authedCookie(): Promise<{
  cookie: string
  organizationId: string
  userId: string
}> {
  const result = await signupUser()
  return {
    cookie: result.cookie,
    organizationId: result.organizationId,
    userId: result.userId,
  }
}

describe("GET /stats/monthly-summary", () => {
  it("returns 401 without a cookie", async () => {
    const res = await honoApp.request("/stats/monthly-summary")
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.code).toBe("UNAUTHORIZED")
  })

  it("returns 401 with an invalid cookie", async () => {
    const res = await honoApp.request("/stats/monthly-summary", {
      headers: { cookie: "penny-duck.session_token=not-a-real-session" },
    })
    expect(res.status).toBe(401)
  })

  it("rejects an out-of-range months query param", async () => {
    const { cookie } = await authedCookie()
    const res = await honoApp.request("/stats/monthly-summary?months=50", {
      headers: { cookie },
    })
    expect(res.status).toBe(400)
  })

  it("returns the default 6 months when no query param is given", async () => {
    const { cookie } = await authedCookie()
    const res = await honoApp.request("/stats/monthly-summary", {
      headers: { cookie },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(6)
    for (const item of body) {
      expect(item.month).toMatch(/^\d{4}-\d{2}$/)
      expect(item.income).toBe(0)
      expect(item.expenses).toBe(0)
    }
  })

  it("aggregates income and expenses for the current month", async () => {
    const { cookie, organizationId, userId } = await authedCookie()
    await flushEvents()

    const account = await createAccount({
      organizationId,
      userId,
      name: "Bank",
      type: "bank",
      currency: "UAH",
      balance: 10000,
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

    await createTransaction({
      organizationId,
      accountId: account.id,
      type: "income",
      amount: 500,
      categoryId,
      date: new Date(),
      madeById: userId,
    })
    await createTransaction({
      organizationId,
      accountId: account.id,
      type: "expense",
      amount: 150,
      categoryId,
      date: new Date(),
      madeById: userId,
    })

    const res = await honoApp.request("/stats/monthly-summary?months=3", {
      headers: { cookie },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(3)
    const current = body[body.length - 1]
    expect(current.income).toBe(500)
    expect(current.expenses).toBe(150)
  })
})
