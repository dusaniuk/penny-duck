import { faker } from "@faker-js/faker"
import { test, expect, type APIRequestContext } from "@playwright/test"
import { signupAndLogin } from "../../shared/factories"

// Wallets share the /accounts resource. Tests assert the contract end-to-end —
// the wire shape is what the frontend reads, so it's worth a real HTTP round
// trip rather than only an in-process service test.

function walletData(
  overrides: Partial<{
    name: string
    color: string
    icon: string
    pockets: Array<{ currency: string; balance: number }>
  }> = {},
) {
  return {
    type: "wallet" as const,
    name: overrides.name ?? `Wallet ${faker.string.alphanumeric(6)}`,
    ...(overrides.color !== undefined ? { color: overrides.color } : {}),
    ...(overrides.icon !== undefined ? { icon: overrides.icon } : {}),
    pockets: overrides.pockets ?? [
      { currency: "USD", balance: 1000 },
      { currency: "EUR", balance: 200 },
    ],
  }
}

async function createWallet(
  request: APIRequestContext,
  overrides?: Parameters<typeof walletData>[0],
) {
  const res = await request.post("/accounts", { data: walletData(overrides) })
  expect(res.status()).toBe(201)
  return res.json()
}

test.describe("Wallets CRUD", () => {
  test.beforeEach(async ({ request }) => {
    await signupAndLogin(request)
  })

  test("creates a wallet with pockets", async ({ request }) => {
    const res = await request.post("/accounts", { data: walletData() })

    expect(res.status()).toBe(201)
    const body = await res.json()
    expect(body).toHaveProperty("id")
    expect(body.type).toBe("wallet")
    expect(body.pockets).toHaveLength(2)
    expect(body.pockets.map((p: { currency: string }) => p.currency).sort()).toEqual([
      "EUR",
      "USD",
    ])
    expect(body.pockets.find((p: { currency: string }) => p.currency === "USD").balance).toBe(
      1000,
    )
    // Wallet has no own currency; only a home-currency total
    expect(body).not.toHaveProperty("currency")
    expect(body).toHaveProperty("totalHomeBalance")
  })

  test("creates a wallet with no pockets", async ({ request }) => {
    const res = await request.post("/accounts", {
      data: walletData({ pockets: [] }),
    })

    expect(res.status()).toBe(201)
    const body = await res.json()
    expect(body.pockets).toEqual([])
    expect(body.totalHomeBalance).toBe(0)
  })

  test("rejects a wallet with duplicate currency pockets", async ({ request }) => {
    const res = await request.post("/accounts", {
      data: walletData({
        pockets: [
          { currency: "USD", balance: 100 },
          { currency: "USD", balance: 200 },
        ],
      }),
    })

    expect(res.status()).toBe(400)
  })

  test("rejects a wallet payload missing pockets", async ({ request }) => {
    const res = await request.post("/accounts", {
      data: { type: "wallet", name: "No pockets field" },
    })

    expect(res.status()).toBe(400)
  })

  test("rejects a payload with unknown type", async ({ request }) => {
    const res = await request.post("/accounts", {
      data: { type: "cash", name: "Old cash type", currency: "UAH" },
    })

    expect(res.status()).toBe(400)
  })

  test("GET /accounts returns wallets and leaf accounts in one list", async ({
    request,
  }) => {
    await createWallet(request, { name: "Travel cash" })
    await request.post("/accounts", {
      data: { type: "bank", name: "Checking", currency: "UAH" },
    })

    const res = await request.get("/accounts")
    expect(res.status()).toBe(200)
    const list = (await res.json()) as Array<{
      type: string
      pockets?: unknown
    }>
    expect(list).toHaveLength(2)
    const wallet = list.find((item) => item.type === "wallet")
    const bank = list.find((item) => item.type === "bank")
    expect(wallet).toBeDefined()
    expect(wallet!.pockets).toBeDefined()
    expect(bank).toBeDefined()
    expect(bank).not.toHaveProperty("pockets")
  })

  test("GET /accounts/:id returns the wallet shape for a wallet id", async ({
    request,
  }) => {
    const created = await createWallet(request)

    const res = await request.get(`/accounts/${created.id}`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.id).toBe(created.id)
    expect(body.type).toBe("wallet")
    expect(body.pockets).toHaveLength(2)
  })

  test("PATCH /accounts/:id renames a wallet", async ({ request }) => {
    const created = await createWallet(request, { name: "Cash" })

    const res = await request.patch(`/accounts/${created.id}`, {
      data: { name: "Renamed" },
    })

    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.name).toBe("Renamed")
    expect(body.type).toBe("wallet")
  })

  test("DELETE /accounts/:id removes an empty wallet", async ({ request }) => {
    const created = await createWallet(request, { pockets: [] })

    const deleteRes = await request.delete(`/accounts/${created.id}`)
    expect(deleteRes.status()).toBe(200)

    const getRes = await request.get(`/accounts/${created.id}`)
    expect(getRes.status()).toBe(404)
  })

  test("rejects deleting a wallet that has pocket transactions (409)", async ({
    request,
  }) => {
    const wallet = await createWallet(request)
    const usdPocket = wallet.pockets.find(
      (p: { currency: string }) => p.currency === "USD",
    )
    expect(usdPocket).toBeDefined()

    // Seeded categories are async; poll for one
    let cats: Array<{ id: string }> = []
    for (let i = 0; i < 10; i++) {
      const catRes = await request.get("/categories")
      cats = await catRes.json()
      if (cats.length > 0) break
      await new Promise((r) => setTimeout(r, 200))
    }

    const txRes = await request.post("/transactions", {
      data: {
        accountId: usdPocket.accountId,
        type: "expense",
        amount: 50,
        categoryId: cats[0].id,
        date: new Date().toISOString(),
      },
    })
    expect(txRes.status()).toBe(201)

    const deleteRes = await request.delete(`/accounts/${wallet.id}`)
    expect(deleteRes.status()).toBe(409)
  })
})

test.describe("Wallet pockets", () => {
  test.beforeEach(async ({ request }) => {
    await signupAndLogin(request)
  })

  test("adds a pocket via POST /accounts/:id/pockets", async ({ request }) => {
    const wallet = await createWallet(request, {
      pockets: [{ currency: "USD", balance: 100 }],
    })

    const res = await request.post(`/accounts/${wallet.id}/pockets`, {
      data: { currency: "PLN", balance: 500 },
    })

    expect(res.status()).toBe(201)
    const body = await res.json()
    expect(body.pockets).toHaveLength(2)
    const plnPocket = body.pockets.find(
      (p: { currency: string }) => p.currency === "PLN",
    )
    expect(plnPocket.balance).toBe(500)
  })

  test("rejects adding a pocket for a currency that already exists (409)", async ({
    request,
  }) => {
    const wallet = await createWallet(request, {
      pockets: [{ currency: "USD", balance: 100 }],
    })

    const res = await request.post(`/accounts/${wallet.id}/pockets`, {
      data: { currency: "USD", balance: 200 },
    })

    expect(res.status()).toBe(409)
  })

  test("deletes an empty pocket via DELETE /accounts/:id/pockets/:currency", async ({
    request,
  }) => {
    const wallet = await createWallet(request)

    const res = await request.delete(`/accounts/${wallet.id}/pockets/USD`)
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.pockets).toHaveLength(1)
    expect(body.pockets[0].currency).toBe("EUR")
  })

  test("rejects deleting a pocket that has transactions (409)", async ({
    request,
  }) => {
    const wallet = await createWallet(request)
    const usdPocket = wallet.pockets.find(
      (p: { currency: string }) => p.currency === "USD",
    )

    let cats: Array<{ id: string }> = []
    for (let i = 0; i < 10; i++) {
      const catRes = await request.get("/categories")
      cats = await catRes.json()
      if (cats.length > 0) break
      await new Promise((r) => setTimeout(r, 200))
    }

    await request.post("/transactions", {
      data: {
        accountId: usdPocket.accountId,
        type: "expense",
        amount: 25,
        categoryId: cats[0].id,
        date: new Date().toISOString(),
      },
    })

    const res = await request.delete(`/accounts/${wallet.id}/pockets/USD`)
    expect(res.status()).toBe(409)
  })

  test("returns 404 when adding a pocket to a non-existent wallet", async ({
    request,
  }) => {
    const res = await request.post(
      "/accounts/00000000-0000-0000-0000-000000000000/pockets",
      { data: { currency: "USD", balance: 100 } },
    )
    expect(res.status()).toBe(404)
  })
})

test.describe("Wallets - auth required", () => {
  test("returns 401 on /accounts without auth", async () => {
    const { env } = await import("../../shared/env")
    const res = await fetch(`${env.API_BASE_URL}/accounts`)
    expect(res.status).toBe(401)
  })
})
