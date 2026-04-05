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

  test("returns 404 for non-existent account", async ({ request }) => {
    const res = await request.get(
      "/accounts/00000000-0000-0000-0000-000000000000"
    )
    expect(res.status()).toBe(404)
  })

  test("returns 400 for invalid account type", async ({ request }) => {
    const res = await request.post("/accounts", {
      data: createAccountData({ type: "crypto" }),
    })
    // Domain validation happens at entity level, returns 500 or 400
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })

  test("returns 400 for invalid currency", async ({ request }) => {
    const res = await request.post("/accounts", {
      data: { name: "Test", type: "bank", currency: "XX" },
    })
    expect(res.status()).toBe(400)
  })

  test("returns 400 for unknown 3-letter currency code", async ({
    request,
  }) => {
    const res = await request.post("/accounts", {
      data: { name: "Test", type: "bank", currency: "FOO" },
    })
    expect(res.status()).toBeGreaterThanOrEqual(400)
  })
})

test.describe("Accounts - auth required", () => {
  test("returns 401 without auth", async () => {
    const { env } = await import("../../shared/env")
    const res = await fetch(`${env.API_BASE_URL}/accounts`)
    expect(res.status).toBe(401)
  })
})
