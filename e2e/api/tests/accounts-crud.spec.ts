import { test, expect } from "@playwright/test"
import { createUserData, createAccountData } from "../../shared/factories"

test.describe("Accounts CRUD", () => {
  test.beforeEach(async ({ request }) => {
    const user = createUserData()
    await request.post("/auth/signup", { data: user })
  })

  test("creates an account", async ({ request }) => {
    const account = createAccountData()

    const res = await request.post("/accounts", { data: account })

    expect(res.status()).toBe(201)
    const body = await res.json()
    expect(body).toHaveProperty("id")
    expect(body.name).toBe(account.name)
    expect(body.type).toBe(account.type)
    expect(body.currency).toBe(account.currency)
    expect(body.balance).toBe(0)
  })

  test("creates an account with initial balance", async ({ request }) => {
    const account = createAccountData({ balance: 5000 })

    const res = await request.post("/accounts", { data: account })

    expect(res.status()).toBe(201)
    const body = await res.json()
    expect(body.balance).toBe(5000)
  })

  test("lists accounts", async ({ request }) => {
    await request.post("/accounts", { data: createAccountData() })
    await request.post("/accounts", { data: createAccountData() })

    const res = await request.get("/accounts")

    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(2)
  })

  test("gets a single account", async ({ request }) => {
    const createRes = await request.post("/accounts", {
      data: createAccountData(),
    })
    const { id } = await createRes.json()

    const res = await request.get(`/accounts/${id}`)

    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.id).toBe(id)
  })

  test("updates an account", async ({ request }) => {
    const createRes = await request.post("/accounts", {
      data: createAccountData(),
    })
    const { id } = await createRes.json()

    const res = await request.patch(`/accounts/${id}`, {
      data: { name: "Updated Name" },
    })

    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.name).toBe("Updated Name")
  })

  test("updates account type", async ({ request }) => {
    const createRes = await request.post("/accounts", {
      data: createAccountData({ type: "bank" }),
    })
    const { id } = await createRes.json()

    const res = await request.patch(`/accounts/${id}`, {
      data: { type: "cash" },
    })

    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.type).toBe("cash")
  })

  test("deletes an account", async ({ request }) => {
    const createRes = await request.post("/accounts", {
      data: createAccountData(),
    })
    const { id } = await createRes.json()

    const deleteRes = await request.delete(`/accounts/${id}`)
    expect(deleteRes.status()).toBe(200)

    const getRes = await request.get(`/accounts/${id}`)
    expect(getRes.status()).toBe(404)
  })

  test("rejects deleting account with transactions (409)", async ({
    request,
  }) => {
    const accRes = await request.post("/accounts", {
      data: createAccountData(),
    })
    const acc = await accRes.json()

    // Wait for seeded categories
    let cats: Array<{ id: string }> = []
    for (let i = 0; i < 10; i++) {
      const catRes = await request.get("/categories")
      cats = await catRes.json()
      if (cats.length > 0) break
      await new Promise((r) => setTimeout(r, 200))
    }

    await request.post("/transactions", {
      data: {
        accountId: acc.id,
        type: "expense",
        amount: 50,
        categoryId: cats[0].id,
        date: new Date().toISOString(),
      },
    })

    const deleteRes = await request.delete(`/accounts/${acc.id}`)
    expect(deleteRes.status()).toBe(409)

    const body = await deleteRes.json()
    expect(body.count).toBe(1)
  })

  test("returns 404 for non-existent account", async ({ request }) => {
    const res = await request.get(
      "/accounts/00000000-0000-0000-0000-000000000000"
    )
    expect(res.status()).toBe(404)
  })

  test("returns 400 for invalid currency length", async ({ request }) => {
    const res = await request.post("/accounts", {
      data: { name: "Test", type: "bank", currency: "XX" },
    })
    expect(res.status()).toBe(400)
  })
})

test.describe("Accounts - auth required", () => {
  test("returns 401 without auth", async () => {
    const { env } = await import("../../shared/env")
    const res = await fetch(`${env.API_BASE_URL}/accounts`)
    expect(res.status).toBe(401)
  })
})
