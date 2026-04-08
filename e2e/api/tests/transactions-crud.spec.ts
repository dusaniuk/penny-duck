import { test, expect } from "@playwright/test"
import {
  createUserData,
  createAccountData,
  createTransactionData,
} from "../../shared/factories"

async function setupAccountAndCategory(request: any) {
  const accRes = await request.post("/accounts", {
    data: createAccountData({ balance: 10000 }),
  })
  const account = await accRes.json()

  const catRes = await request.get("/categories")
  const categories = await catRes.json()
  // Use first available category (auto-seeded on signup)
  const category = categories[0]

  return { account, category }
}

async function waitForBalance(
  request: any,
  accountId: string,
  expected: number,
  maxRetries = 10,
): Promise<number> {
  for (let i = 0; i < maxRetries; i++) {
    const res = await request.get(`/accounts/${accountId}`)
    const body = await res.json()
    if (body.balance === expected) return body.balance
    await new Promise((r) => setTimeout(r, 200))
  }
  const res = await request.get(`/accounts/${accountId}`)
  const body = await res.json()
  return body.balance
}

async function waitForCategories(
  request: any,
  expectedCount: number,
  maxRetries = 10,
): Promise<any[]> {
  for (let i = 0; i < maxRetries; i++) {
    const res = await request.get("/categories")
    const body = await res.json()
    if (body.length >= expectedCount) return body
    await new Promise((r) => setTimeout(r, 200))
  }
  const res = await request.get("/categories")
  return res.json()
}

test.describe("Transactions CRUD", () => {
  test.beforeEach(async ({ request }) => {
    const user = createUserData()
    await request.post("/auth/signup", { data: user })
    await waitForCategories(request, 1)
  })

  test("creates an expense transaction", async ({ request }) => {
    const { account, category } = await setupAccountAndCategory(request)
    const data = createTransactionData({
      accountId: account.id,
      categoryId: category.id,
      type: "expense",
      amount: 50.25,
      note: "lunch",
    })

    const res = await request.post("/transactions", { data })

    expect(res.status()).toBe(201)
    const body = await res.json()
    expect(body).toHaveProperty("id")
    expect(body.accountId).toBe(account.id)
    expect(body.type).toBe("expense")
    expect(body.amount).toBe(50.25)
    expect(body.categoryId).toBe(category.id)
    expect(body.note).toBe("lunch")
    expect(body.settled).toBe(true)
  })

  test("creates an income transaction", async ({ request }) => {
    const { account, category } = await setupAccountAndCategory(request)
    const data = createTransactionData({
      accountId: account.id,
      categoryId: category.id,
      type: "income",
      amount: 1000,
    })

    const res = await request.post("/transactions", { data })

    expect(res.status()).toBe(201)
    const body = await res.json()
    expect(body.type).toBe("income")
    expect(body.amount).toBe(1000)
  })

  test("creates a shared (unsettled) transaction", async ({ request }) => {
    const { account, category } = await setupAccountAndCategory(request)
    const data = createTransactionData({
      accountId: account.id,
      categoryId: category.id,
      amount: 100,
      myShare: 40,
    })

    const res = await request.post("/transactions", { data })

    expect(res.status()).toBe(201)
    const body = await res.json()
    expect(body.myShare).toBe(40)
    expect(body.settled).toBe(false)
  })

  test("creates a transaction with exchange rate", async ({ request }) => {
    const { account, category } = await setupAccountAndCategory(request)
    const data = createTransactionData({
      accountId: account.id,
      categoryId: category.id,
      amount: 100,
      originalAmount: 4152,
      originalCurrency: "UAH",
      exchangeRate: 41.52,
    })

    const res = await request.post("/transactions", { data })

    expect(res.status()).toBe(201)
    const body = await res.json()
    expect(body.originalAmount).toBe(4152)
    expect(body.originalCurrency).toBe("UAH")
    expect(body.exchangeRate).toBe(41.52)
  })

  test("lists transactions with pagination", async ({ request }) => {
    const { account, category } = await setupAccountAndCategory(request)
    for (let i = 0; i < 3; i++) {
      await request.post("/transactions", {
        data: createTransactionData({
          accountId: account.id,
          categoryId: category.id,
        }),
      })
    }

    const res = await request.get("/transactions")

    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(3)
    expect(body.total).toBe(3)
    expect(body).toHaveProperty("page")
    expect(body).toHaveProperty("limit")
  })

  test("filters transactions by type", async ({ request }) => {
    const { account, category } = await setupAccountAndCategory(request)
    await request.post("/transactions", {
      data: createTransactionData({
        accountId: account.id,
        categoryId: category.id,
        type: "expense",
      }),
    })
    await request.post("/transactions", {
      data: createTransactionData({
        accountId: account.id,
        categoryId: category.id,
        type: "income",
      }),
    })

    const res = await request.get("/transactions?type=expense")

    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].type).toBe("expense")
  })

  test("filters transactions by settled status", async ({ request }) => {
    const { account, category } = await setupAccountAndCategory(request)
    await request.post("/transactions", {
      data: createTransactionData({
        accountId: account.id,
        categoryId: category.id,
        amount: 100,
        myShare: 40,
      }),
    })
    await request.post("/transactions", {
      data: createTransactionData({
        accountId: account.id,
        categoryId: category.id,
      }),
    })

    const res = await request.get("/transactions?settled=false")

    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.data).toHaveLength(1)
    expect(body.data[0].settled).toBe(false)
  })

  test("gets a single transaction", async ({ request }) => {
    const { account, category } = await setupAccountAndCategory(request)
    const createRes = await request.post("/transactions", {
      data: createTransactionData({
        accountId: account.id,
        categoryId: category.id,
      }),
    })
    const { id } = await createRes.json()

    const res = await request.get(`/transactions/${id}`)

    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.id).toBe(id)
  })

  test("updates a transaction", async ({ request }) => {
    const { account, category } = await setupAccountAndCategory(request)
    const createRes = await request.post("/transactions", {
      data: createTransactionData({
        accountId: account.id,
        categoryId: category.id,
        amount: 50,
      }),
    })
    const { id } = await createRes.json()

    const res = await request.patch(`/transactions/${id}`, {
      data: { amount: 75, note: "updated" },
    })

    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.amount).toBe(75)
    expect(body.note).toBe("updated")
  })

  test("deletes a transaction", async ({ request }) => {
    const { account, category } = await setupAccountAndCategory(request)
    const createRes = await request.post("/transactions", {
      data: createTransactionData({
        accountId: account.id,
        categoryId: category.id,
      }),
    })
    const { id } = await createRes.json()

    const deleteRes = await request.delete(`/transactions/${id}`)
    expect(deleteRes.status()).toBe(200)

    const getRes = await request.get(`/transactions/${id}`)
    expect(getRes.status()).toBe(404)
  })

  test("settles a shared transaction", async ({ request }) => {
    const { account, category } = await setupAccountAndCategory(request)
    const createRes = await request.post("/transactions", {
      data: createTransactionData({
        accountId: account.id,
        categoryId: category.id,
        amount: 100,
        myShare: 40,
      }),
    })
    const { id } = await createRes.json()

    const res = await request.patch(`/transactions/${id}/settle`)

    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.settled).toBe(true)
    expect(body.myShare).toBe(40)
  })

  test("returns 404 for non-existent transaction", async ({ request }) => {
    const res = await request.get(
      "/transactions/00000000-0000-0000-0000-000000000000",
    )
    expect(res.status()).toBe(404)
  })

  test("returns 400 for missing required fields", async ({ request }) => {
    const res = await request.post("/transactions", {
      data: { amount: 50 },
    })
    expect(res.status()).toBe(400)
  })

  test("updates account balance on expense", async ({ request }) => {
    const { account, category } = await setupAccountAndCategory(request)

    await request.post("/transactions", {
      data: createTransactionData({
        accountId: account.id,
        categoryId: category.id,
        type: "expense",
        amount: 200,
      }),
    })

    const balance = await waitForBalance(request, account.id, 9800)
    expect(balance).toBe(9800)
  })

  test("updates account balance on income", async ({ request }) => {
    const { account, category } = await setupAccountAndCategory(request)

    await request.post("/transactions", {
      data: createTransactionData({
        accountId: account.id,
        categoryId: category.id,
        type: "income",
        amount: 500,
      }),
    })

    const balance = await waitForBalance(request, account.id, 10500)
    expect(balance).toBe(10500)
  })

  test("reverses balance on delete", async ({ request }) => {
    const { account, category } = await setupAccountAndCategory(request)

    const createRes = await request.post("/transactions", {
      data: createTransactionData({
        accountId: account.id,
        categoryId: category.id,
        type: "expense",
        amount: 200,
      }),
    })
    const { id } = await createRes.json()

    await waitForBalance(request, account.id, 9800)
    await request.delete(`/transactions/${id}`)

    const balance = await waitForBalance(request, account.id, 10000)
    expect(balance).toBe(10000)
  })
})

test.describe("Transfers", () => {
  test.beforeEach(async ({ request }) => {
    const user = createUserData()
    await request.post("/auth/signup", { data: user })
    await waitForCategories(request, 1)
  })

  test("creates a same-currency transfer", async ({ request }) => {
    const acc1Res = await request.post("/accounts", {
      data: createAccountData({ balance: 5000, currency: "UAH" }),
    })
    const acc1 = await acc1Res.json()
    const acc2Res = await request.post("/accounts", {
      data: createAccountData({ balance: 1000, currency: "UAH" }),
    })
    const acc2 = await acc2Res.json()

    const res = await request.post("/transactions/transfers", {
      data: {
        fromAccountId: acc1.id,
        toAccountId: acc2.id,
        amount: 500,
        date: new Date().toISOString(),
      },
    })

    expect(res.status()).toBe(201)
    const body = await res.json()
    expect(body.outgoing.accountId).toBe(acc1.id)
    expect(body.outgoing.amount).toBe(500)
    expect(body.outgoing.type).toBe("transfer")
    expect(body.incoming.accountId).toBe(acc2.id)
    expect(body.incoming.amount).toBe(500)
    expect(body.outgoing.transferId).toBe(body.incoming.transferId)

    // Verify balances
    const a1 = await (await request.get(`/accounts/${acc1.id}`)).json()
    const a2 = await (await request.get(`/accounts/${acc2.id}`)).json()
    expect(a1.balance).toBe(4500)
    expect(a2.balance).toBe(1500)
  })

  test("creates a cross-currency transfer", async ({ request }) => {
    const usdRes = await request.post("/accounts", {
      data: createAccountData({ balance: 1000, currency: "USD" }),
    })
    const usd = await usdRes.json()
    const uahRes = await request.post("/accounts", {
      data: createAccountData({ balance: 0, currency: "UAH" }),
    })
    const uah = await uahRes.json()

    const res = await request.post("/transactions/transfers", {
      data: {
        fromAccountId: usd.id,
        toAccountId: uah.id,
        amount: 100,
        date: new Date().toISOString(),
        originalAmount: 4152,
        originalCurrency: "UAH",
        exchangeRate: 41.52,
      },
    })

    expect(res.status()).toBe(201)
    const body = await res.json()
    expect(body.outgoing.amount).toBe(100)
    expect(body.outgoing.exchangeRate).toBe(41.52)
    expect(body.incoming.amount).toBe(4152)

    // Verify balances
    const u = await (await request.get(`/accounts/${usd.id}`)).json()
    const h = await (await request.get(`/accounts/${uah.id}`)).json()
    expect(u.balance).toBe(900)
    expect(h.balance).toBe(4152)
  })

  test("rejects transfer to same account", async ({ request }) => {
    const accRes = await request.post("/accounts", {
      data: createAccountData({ balance: 5000 }),
    })
    const acc = await accRes.json()

    const res = await request.post("/transactions/transfers", {
      data: {
        fromAccountId: acc.id,
        toAccountId: acc.id,
        amount: 100,
        date: new Date().toISOString(),
      },
    })

    expect(res.status()).toBe(400)
  })

  test("updates a transfer", async ({ request }) => {
    const acc1Res = await request.post("/accounts", {
      data: createAccountData({ balance: 5000, currency: "UAH" }),
    })
    const acc1 = await acc1Res.json()
    const acc2Res = await request.post("/accounts", {
      data: createAccountData({ balance: 1000, currency: "UAH" }),
    })
    const acc2 = await acc2Res.json()

    const createRes = await request.post("/transactions/transfers", {
      data: {
        fromAccountId: acc1.id,
        toAccountId: acc2.id,
        amount: 500,
        date: new Date().toISOString(),
      },
    })
    const { outgoing } = await createRes.json()

    const res = await request.patch(
      `/transactions/transfers/${outgoing.transferId}`,
      { data: { amount: 300, note: "adjusted" } },
    )

    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.outgoing.amount).toBe(300)
    expect(body.outgoing.note).toBe("adjusted")
    expect(body.incoming.amount).toBe(300)
    expect(body.incoming.note).toBe("adjusted")
  })

  test("deletes a transfer", async ({ request }) => {
    const acc1Res = await request.post("/accounts", {
      data: createAccountData({ balance: 5000, currency: "UAH" }),
    })
    const acc1 = await acc1Res.json()
    const acc2Res = await request.post("/accounts", {
      data: createAccountData({ balance: 1000, currency: "UAH" }),
    })
    const acc2 = await acc2Res.json()

    const createRes = await request.post("/transactions/transfers", {
      data: {
        fromAccountId: acc1.id,
        toAccountId: acc2.id,
        amount: 500,
        date: new Date().toISOString(),
      },
    })
    const { outgoing } = await createRes.json()

    const deleteRes = await request.delete(
      `/transactions/transfers/${outgoing.transferId}`,
    )
    expect(deleteRes.status()).toBe(200)

    // Verify balances restored
    const a1 = await (await request.get(`/accounts/${acc1.id}`)).json()
    const a2 = await (await request.get(`/accounts/${acc2.id}`)).json()
    expect(a1.balance).toBe(5000)
    expect(a2.balance).toBe(1000)
  })

  test("rejects delete on transfer via regular endpoint", async ({
    request,
  }) => {
    const acc1Res = await request.post("/accounts", {
      data: createAccountData({ balance: 5000 }),
    })
    const acc1 = await acc1Res.json()
    const acc2Res = await request.post("/accounts", {
      data: createAccountData({ balance: 1000 }),
    })
    const acc2 = await acc2Res.json()

    const createRes = await request.post("/transactions/transfers", {
      data: {
        fromAccountId: acc1.id,
        toAccountId: acc2.id,
        amount: 500,
        date: new Date().toISOString(),
      },
    })
    const { outgoing } = await createRes.json()

    const deleteRes = await request.delete(
      `/transactions/${outgoing.id}`,
    )
    expect(deleteRes.status()).toBe(400)
  })
})

test.describe("Transactions - auth required", () => {
  test("returns 401 without auth", async () => {
    const { env } = await import("../../shared/env")
    const res = await fetch(`${env.API_BASE_URL}/transactions`)
    expect(res.status).toBe(401)
  })
})
