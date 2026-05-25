import { faker } from "@faker-js/faker"
import { test, expect, type APIRequestContext } from "@playwright/test"
import { createAccountData, signupAndLogin } from "../../shared/factories"

// Pockets are real account rows on the backend (with walletId set). Once a
// pocket is created, transactions and transfers against it behave exactly like
// against a standalone account — these tests pin that down end-to-end.

async function createCategory(
  request: APIRequestContext,
): Promise<{ id: string }> {
  const res = await request.post("/categories", {
    data: { name: "Groceries", color: "red" },
  })
  expect(res.status()).toBe(201)
  return res.json()
}

async function createWallet(
  request: APIRequestContext,
  pockets: Array<{ currency: string; balance: number }>,
) {
  const res = await request.post("/accounts", {
    data: {
      type: "wallet",
      name: `Wallet ${faker.string.alphanumeric(6)}`,
      pockets,
    },
  })
  expect(res.status()).toBe(201)
  return res.json()
}

async function getWallet(request: APIRequestContext, walletId: string) {
  const res = await request.get(`/accounts/${walletId}`)
  expect(res.status()).toBe(200)
  return res.json()
}

function pocketByCurrency(
  wallet: { pockets: Array<{ accountId: string; currency: string; balance: number }> },
  currency: string,
) {
  const p = wallet.pockets.find((x) => x.currency === currency)
  expect(p, `expected pocket ${currency} on wallet`).toBeDefined()
  return p!
}

test.describe("Transactions against wallet pockets", () => {
  test.beforeEach(async ({ request }) => {
    await signupAndLogin(request)
  })

  test("records an expense against a pocket and updates that pocket's balance", async ({
    request,
  }) => {
    const wallet = await createWallet(request, [
      { currency: "USD", balance: 1000 },
      { currency: "EUR", balance: 200 },
    ])
    const usdPocket = pocketByCurrency(wallet, "USD")
    const category = await createCategory(request)

    const txRes = await request.post("/transactions", {
      data: {
        accountId: usdPocket.accountId,
        type: "expense",
        amount: 75,
        categoryId: category.id,
        date: new Date().toISOString(),
      },
    })
    expect(txRes.status()).toBe(201)
    const tx = await txRes.json()
    expect(tx.accountId).toBe(usdPocket.accountId)

    // EUR pocket should not have moved
    const refreshed = await getWallet(request, wallet.id)
    expect(pocketByCurrency(refreshed, "USD").balance).toBe(925)
    expect(pocketByCurrency(refreshed, "EUR").balance).toBe(200)
  })

  test("records income against a pocket", async ({ request }) => {
    const wallet = await createWallet(request, [
      { currency: "USD", balance: 100 },
    ])
    const usdPocket = pocketByCurrency(wallet, "USD")
    const category = await createCategory(request)

    const txRes = await request.post("/transactions", {
      data: {
        accountId: usdPocket.accountId,
        type: "income",
        amount: 250,
        categoryId: category.id,
        date: new Date().toISOString(),
      },
    })
    expect(txRes.status()).toBe(201)

    const refreshed = await getWallet(request, wallet.id)
    expect(pocketByCurrency(refreshed, "USD").balance).toBe(350)
  })

  test("reverses a pocket's balance when its transaction is deleted", async ({
    request,
  }) => {
    const wallet = await createWallet(request, [
      { currency: "USD", balance: 500 },
    ])
    const usdPocket = pocketByCurrency(wallet, "USD")
    const category = await createCategory(request)

    const txRes = await request.post("/transactions", {
      data: {
        accountId: usdPocket.accountId,
        type: "expense",
        amount: 100,
        categoryId: category.id,
        date: new Date().toISOString(),
      },
    })
    const { id: txId } = await txRes.json()

    let mid = await getWallet(request, wallet.id)
    expect(pocketByCurrency(mid, "USD").balance).toBe(400)

    const delRes = await request.delete(`/transactions/${txId}`)
    expect(delRes.status()).toBe(200)

    mid = await getWallet(request, wallet.id)
    expect(pocketByCurrency(mid, "USD").balance).toBe(500)
  })
})

test.describe("Transfers involving wallet pockets", () => {
  test.beforeEach(async ({ request }) => {
    await signupAndLogin(request)
  })

  test("transfers from a pocket to a standalone account (same currency)", async ({
    request,
  }) => {
    const wallet = await createWallet(request, [
      { currency: "UAH", balance: 5000 },
    ])
    const pocket = pocketByCurrency(wallet, "UAH")

    const bankRes = await request.post("/accounts", {
      data: createAccountData({
        type: "bank",
        currency: "UAH",
        balance: 1000,
      }),
    })
    const bank = await bankRes.json()

    const transferRes = await request.post("/transactions/transfers", {
      data: {
        fromAccountId: pocket.accountId,
        toAccountId: bank.id,
        amount: 1500,
        date: new Date().toISOString(),
      },
    })
    expect(transferRes.status()).toBe(201)

    const refreshedWallet = await getWallet(request, wallet.id)
    expect(pocketByCurrency(refreshedWallet, "UAH").balance).toBe(3500)
    const refreshedBank = await (await request.get(`/accounts/${bank.id}`)).json()
    expect(refreshedBank.balance).toBe(2500)
  })

  test("in-wallet conversion: cross-currency transfer between two pockets", async ({
    request,
  }) => {
    const wallet = await createWallet(request, [
      { currency: "USD", balance: 1000 },
      { currency: "UAH", balance: 0 },
    ])
    const usd = pocketByCurrency(wallet, "USD")
    const uah = pocketByCurrency(wallet, "UAH")

    // 100 USD → 4152 UAH @ 41.52
    const res = await request.post("/transactions/transfers", {
      data: {
        fromAccountId: usd.accountId,
        toAccountId: uah.accountId,
        amount: 100,
        date: new Date().toISOString(),
        originalAmount: 4152,
        originalCurrency: "UAH",
        exchangeRate: 41.52,
      },
    })
    expect(res.status()).toBe(201)
    const body = await res.json()
    expect(body.outgoing.accountId).toBe(usd.accountId)
    expect(body.outgoing.amount).toBe(100)
    expect(body.outgoing.exchangeRate).toBe(41.52)
    expect(body.incoming.accountId).toBe(uah.accountId)
    expect(body.incoming.amount).toBe(4152)

    const refreshed = await getWallet(request, wallet.id)
    expect(pocketByCurrency(refreshed, "USD").balance).toBe(900)
    expect(pocketByCurrency(refreshed, "UAH").balance).toBe(4152)
  })

  test("rejects transferring from a pocket to itself", async ({ request }) => {
    const wallet = await createWallet(request, [
      { currency: "USD", balance: 1000 },
    ])
    const pocket = pocketByCurrency(wallet, "USD")

    const res = await request.post("/transactions/transfers", {
      data: {
        fromAccountId: pocket.accountId,
        toAccountId: pocket.accountId,
        amount: 100,
        date: new Date().toISOString(),
      },
    })

    expect(res.status()).toBe(400)
  })

  test("reverses both pocket balances when an in-wallet conversion is deleted", async ({
    request,
  }) => {
    const wallet = await createWallet(request, [
      { currency: "USD", balance: 1000 },
      { currency: "EUR", balance: 0 },
    ])
    const usd = pocketByCurrency(wallet, "USD")
    const eur = pocketByCurrency(wallet, "EUR")

    const createRes = await request.post("/transactions/transfers", {
      data: {
        fromAccountId: usd.accountId,
        toAccountId: eur.accountId,
        amount: 50,
        date: new Date().toISOString(),
        originalAmount: 46,
        originalCurrency: "EUR",
        exchangeRate: 0.92,
      },
    })
    const { outgoing } = await createRes.json()

    let refreshed = await getWallet(request, wallet.id)
    expect(pocketByCurrency(refreshed, "USD").balance).toBe(950)
    expect(pocketByCurrency(refreshed, "EUR").balance).toBe(46)

    const delRes = await request.delete(
      `/transactions/transfers/${outgoing.transferId}`,
    )
    expect(delRes.status()).toBe(200)

    refreshed = await getWallet(request, wallet.id)
    expect(pocketByCurrency(refreshed, "USD").balance).toBe(1000)
    expect(pocketByCurrency(refreshed, "EUR").balance).toBe(0)
  })
})
