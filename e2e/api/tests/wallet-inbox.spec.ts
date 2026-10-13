import { test, expect } from "@playwright/test"
import { env } from "../../shared/env"
import { createAccountData, signupAndLogin } from "../../shared/factories"

test.describe("Wallet inbox API", () => {
  test("ingests with a key and accepts into transactions", async ({
    request,
  }) => {
    await signupAndLogin(request)

    const accountRes = await request.post("/accounts", {
      data: {
        ...createAccountData({ type: "bank", currency: "UAH" }),
        cardLabel: "Mono Black",
      },
    })
    expect(accountRes.status()).toBe(201)
    const account = await accountRes.json()

    const categoryRes = await request.post("/categories", {
      data: { name: `Wallet ${Date.now()}`, type: "expense", color: "red" },
    })
    expect(categoryRes.status()).toBe(201)
    const category = await categoryRes.json()

    const keyRes = await request.post("/auth/api-key/create", {
      data: { name: "e2e" },
    })
    expect(keyRes.status()).toBe(200)
    const { key } = await keyRes.json()

    const tap = {
      card: "Mono Black",
      merchant: "Silpo",
      amount: 99.5,
      currency: "UAH",
      occurredAt: new Date().toISOString(),
    }
    const ingestRes = await request.post("/inbox/wallet", {
      headers: { "x-api-key": key, cookie: "" },
      data: tap,
    })
    expect(ingestRes.status()).toBe(201)
    const item = await ingestRes.json()
    expect(item.accountId).toBe(account.id)

    const dupRes = await request.post("/inbox/wallet", {
      headers: { "x-api-key": key, cookie: "" },
      data: tap,
    })
    expect(dupRes.status()).toBe(200)

    const acceptRes = await request.post(`/inbox/${item.id}/accept`, {
      data: { accountId: account.id, categoryId: category.id },
    })
    expect(acceptRes.status()).toBe(200)
    const { transaction } = await acceptRes.json()
    expect(transaction.amount).toBe(99.5)
    expect(transaction.note).toBe("Silpo")

    const listRes = await request.get("/inbox?status=pending")
    expect((await listRes.json()).total).toBe(0)
  })

  test("rejects a missing key", async ({ request }) => {
    const res = await request.post(`${env.API_BASE_URL}/inbox/wallet`, {
      headers: { cookie: "" },
      data: { card: "x", amount: 1, currency: "UAH" },
    })
    expect(res.status()).toBe(401)
  })
})
