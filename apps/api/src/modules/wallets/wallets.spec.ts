import { beforeAll, afterAll, beforeEach, describe, it, expect } from "bun:test"
import { eq } from "drizzle-orm"
import { accounts, exchangeRates } from "@workspace/db"
import { honoApp } from "@/app"
import { db } from "@/db"
import {
  closeTestApp,
  createTestApp,
  signupUser,
  truncateAll,
} from "@/test/setup"

let cookie: string

async function seedRates() {
  const today = new Date().toISOString().split("T")[0]
  await db.insert(exchangeRates).values([
    { date: today, base: "USD", target: "UAH", rate: 41 },
    { date: today, base: "EUR", target: "UAH", rate: 45 },
    { date: today, base: "PLN", target: "UAH", rate: 10 },
  ])
}

// Wallets are created through the unified /accounts endpoint with type "wallet".
function createWalletHttp(body: {
  name: string
  color?: string
  pockets: Array<{ currency: string; balance: number }>
}) {
  return honoApp.request("/accounts", {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ type: "wallet", ...body }),
  })
}

async function createCategoryHttp() {
  const res = await honoApp.request("/categories", {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({
      name: "Groceries",
      icon: "cart",
      type: "expense",
      color: "red",
    }),
  })
  return res.json()
}

beforeAll(async () => {
  await createTestApp()
})

afterAll(() => closeTestApp())

beforeEach(async () => {
  await truncateAll()
  const result = await signupUser()
  cookie = result.cookie
  await seedRates()
})

describe("POST /accounts (wallet)", () => {
  it("creates a wallet with multiple pockets atomically", async () => {
    const res = await createWalletHttp({
      name: "Main Wallet",
      color: "violet",
      pockets: [
        { currency: "USD", balance: 200 },
        { currency: "EUR", balance: 100 },
        { currency: "PLN", balance: 500 },
      ],
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBeDefined()
    expect(body.type).toBe("wallet")
    expect(body.name).toBe("Main Wallet")
    expect(body.pockets).toHaveLength(3)
    expect(
      body.pockets.map((p: { currency: string }) => p.currency).sort()
    ).toEqual(["EUR", "PLN", "USD"])
    const usd = body.pockets.find(
      (p: { currency: string }) => p.currency === "USD"
    )
    expect(usd.balance).toBe(200)
  })

  it("rejects duplicate currencies in pockets", async () => {
    const res = await createWalletHttp({
      name: "Bad Wallet",
      pockets: [
        { currency: "USD", balance: 100 },
        { currency: "USD", balance: 50 },
      ],
    })
    expect(res.status).toBe(400)
  })

  it("allows creating an empty wallet (no pockets)", async () => {
    const res = await createWalletHttp({ name: "Empty", pockets: [] })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.pockets).toEqual([])
  })
})

describe("PATCH /accounts/:id (wallet)", () => {
  it("updates name, color, icon", async () => {
    const created = await (
      await createWalletHttp({ name: "Old", pockets: [] })
    ).json()

    const res = await honoApp.request(`/accounts/${created.id}`, {
      method: "PATCH",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ name: "New", color: "lime", icon: "wallet" }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.name).toBe("New")
    expect(body.color).toBe("lime")
    expect(body.icon).toBe("wallet")
  })

  it("returns 404 for missing wallet", async () => {
    const res = await honoApp.request(
      "/accounts/00000000-0000-0000-0000-000000000000",
      {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ name: "Nope" }),
      }
    )
    expect(res.status).toBe(404)
  })
})

describe("DELETE /accounts/:id (wallet)", () => {
  it("deletes an empty wallet", async () => {
    const created = await (
      await createWalletHttp({ name: "W", pockets: [] })
    ).json()

    const res = await honoApp.request(`/accounts/${created.id}`, {
      method: "DELETE",
      headers: { cookie },
    })
    expect(res.status).toBe(200)

    const accountsRes = await honoApp.request("/accounts", {
      headers: { cookie },
    })
    const list = (await accountsRes.json()) as Array<{ type: string }>
    expect(list.filter((a) => a.type === "wallet")).toHaveLength(0)
  })

  it("deletes a wallet whose pockets have no transactions, cascading the pockets", async () => {
    const created = await (
      await createWalletHttp({
        name: "W",
        pockets: [{ currency: "USD", balance: 50 }],
      })
    ).json()

    const res = await honoApp.request(`/accounts/${created.id}`, {
      method: "DELETE",
      headers: { cookie },
    })
    expect(res.status).toBe(200)
  })

  it("returns 409 when any pocket has a transaction", async () => {
    const created = await (
      await createWalletHttp({
        name: "W",
        pockets: [{ currency: "USD", balance: 0 }],
      })
    ).json()
    const pocket = created.pockets[0]
    const category = await createCategoryHttp()

    await honoApp.request("/transactions", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({
        accountId: pocket.accountId,
        type: "expense",
        amount: 10,
        categoryId: category.id,
        date: new Date().toISOString(),
      }),
    })

    const res = await honoApp.request(`/accounts/${created.id}`, {
      method: "DELETE",
      headers: { cookie },
    })
    expect(res.status).toBe(409)
  })
})

describe("POST /accounts/:id/pockets", () => {
  it("archives a wallet together with its pockets", async () => {
    const created = (await (
      await createWalletHttp({
        name: "W",
        pockets: [{ currency: "USD", balance: 50 }],
      })
    ).json()) as { id: string; pockets: Array<{ accountId: string }> }

    const res = await honoApp.request(`/accounts/${created.id}/archive`, {
      method: "PUT",
      headers: { cookie },
    })
    expect(res.status).toBe(200)
    const wallet = (await res.json()) as {
      id: string
      type: string
      archivedAt: string | null
    }
    expect(wallet.type).toBe("wallet")
    expect(wallet.archivedAt).not.toBeNull()

    const [pocket] = await db
      .select({ archivedAt: accounts.archivedAt })
      .from(accounts)
      .where(eq(accounts.id, created.pockets[0].accountId))
    expect(pocket.archivedAt).not.toBeNull()
  })

  it("unarchives a wallet together with its pockets", async () => {
    const created = (await (
      await createWalletHttp({
        name: "W",
        pockets: [{ currency: "USD", balance: 50 }],
      })
    ).json()) as { id: string; pockets: Array<{ accountId: string }> }
    await honoApp.request(`/accounts/${created.id}/archive`, {
      method: "PUT",
      headers: { cookie },
    })

    const res = await honoApp.request(`/accounts/${created.id}/archive`, {
      method: "DELETE",
      headers: { cookie },
    })
    expect(res.status).toBe(200)
    expect(
      ((await res.json()) as { archivedAt: string | null }).archivedAt
    ).toBeNull()

    const [pocket] = await db
      .select({ archivedAt: accounts.archivedAt })
      .from(accounts)
      .where(eq(accounts.id, created.pockets[0].accountId))
    expect(pocket.archivedAt).toBeNull()
  })

  it("adds a new pocket", async () => {
    const created = await (
      await createWalletHttp({
        name: "W",
        pockets: [{ currency: "USD", balance: 100 }],
      })
    ).json()

    const res = await honoApp.request(`/accounts/${created.id}/pockets`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ currency: "EUR", balance: 50 }),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(
      body.pockets.map((p: { currency: string }) => p.currency).sort()
    ).toEqual(["EUR", "USD"])
  })

  it("returns 409 when currency already exists in wallet", async () => {
    const created = await (
      await createWalletHttp({
        name: "W",
        pockets: [{ currency: "USD", balance: 100 }],
      })
    ).json()

    const res = await honoApp.request(`/accounts/${created.id}/pockets`, {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ currency: "USD", balance: 50 }),
    })
    expect(res.status).toBe(409)
  })
})

describe("DELETE /accounts/:id/pockets/:currency", () => {
  it("deletes an empty pocket", async () => {
    const created = await (
      await createWalletHttp({
        name: "W",
        pockets: [
          { currency: "USD", balance: 100 },
          { currency: "EUR", balance: 0 },
        ],
      })
    ).json()

    const res = await honoApp.request(`/accounts/${created.id}/pockets/EUR`, {
      method: "DELETE",
      headers: { cookie },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.pockets.map((p: { currency: string }) => p.currency)).toEqual([
      "USD",
    ])
  })

  it("returns 409 when pocket has transactions", async () => {
    const created = await (
      await createWalletHttp({
        name: "W",
        pockets: [{ currency: "USD", balance: 0 }],
      })
    ).json()
    const pocket = created.pockets[0]
    const category = await createCategoryHttp()
    await honoApp.request("/transactions", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({
        accountId: pocket.accountId,
        type: "expense",
        amount: 10,
        categoryId: category.id,
        date: new Date().toISOString(),
      }),
    })

    const res = await honoApp.request(`/accounts/${created.id}/pockets/USD`, {
      method: "DELETE",
      headers: { cookie },
    })
    expect(res.status).toBe(409)
  })
})
