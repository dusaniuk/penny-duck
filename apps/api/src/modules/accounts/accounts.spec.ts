import { beforeAll, afterAll, beforeEach, describe, it, expect } from "bun:test"
import type { Account } from "@workspace/api-contract"
import { exchangeRates } from "@workspace/db"
import { honoApp } from "@/app"
import { db } from "@/db"
import { generateInviteCode } from "@/modules/invites/service"
import { createCategory } from "@/modules/categories/service"
import { createTransaction } from "@/modules/transactions/service"
import { quoteMock } from "@/test/yahoo-mock"
import {
  closeTestApp,
  createTestApp,
  signupUser,
  truncateAll,
} from "@/test/setup"

let cookie: string
let organizationId: string
let userId: string

beforeAll(async () => {
  await createTestApp()
})

afterAll(() => closeTestApp())

beforeEach(async () => {
  await truncateAll()
  const result = await signupUser()
  organizationId = result.organizationId
  userId = result.userId
  cookie = result.cookie
})

interface CreateBody {
  name: string
  type: string
  currency: string
  balance?: number
}

async function createAccountHttp(
  body: CreateBody,
  cookieValue: string = cookie,
  expectedStatus = 201
): Promise<Account> {
  const res = await honoApp.request("/accounts", {
    method: "POST",
    headers: { cookie: cookieValue, "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  expect(res.status).toBe(expectedStatus)
  return res.json()
}

async function listAccountsHttp(
  cookieValue: string = cookie
): Promise<Account[]> {
  const res = await honoApp.request("/accounts", {
    headers: { cookie: cookieValue },
  })
  expect(res.status).toBe(200)
  const body = (await res.json()) as Array<{ type: string }>
  return body.filter((a) => a.type !== "wallet") as Account[]
}

async function getAccountHttp(
  id: string,
  cookieValue: string = cookie,
  expectedStatus = 200
): Promise<Account> {
  const res = await honoApp.request(`/accounts/${id}`, {
    headers: { cookie: cookieValue },
  })
  expect(res.status).toBe(expectedStatus)
  return res.json()
}

async function updateAccountHttp(
  id: string,
  body: Record<string, unknown>,
  cookieValue: string = cookie,
  expectedStatus = 200
): Promise<Account> {
  const res = await honoApp.request(`/accounts/${id}`, {
    method: "PATCH",
    headers: { cookie: cookieValue, "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  expect(res.status).toBe(expectedStatus)
  return res.json()
}

async function deleteAccountHttp(
  id: string,
  cookieValue: string = cookie,
  expectedStatus = 200
): Promise<Response> {
  const res = await honoApp.request(`/accounts/${id}`, {
    method: "DELETE",
    headers: { cookie: cookieValue },
  })
  expect(res.status).toBe(expectedStatus)
  return res
}

async function setDefaultHttp(
  id: string,
  cookieValue: string = cookie,
  expectedStatus = 200
): Promise<Account> {
  const res = await honoApp.request(`/accounts/${id}/default`, {
    method: "PUT",
    headers: { cookie: cookieValue },
  })
  expect(res.status).toBe(expectedStatus)
  return res.json()
}

async function clearDefaultHttp(
  id: string,
  cookieValue: string = cookie,
  expectedStatus = 200
): Promise<Response> {
  const res = await honoApp.request(`/accounts/${id}/default`, {
    method: "DELETE",
    headers: { cookie: cookieValue },
  })
  expect(res.status).toBe(expectedStatus)
  return res
}

describe("Accounts — auth", () => {
  it("rejects unauthenticated list", async () => {
    const res = await honoApp.request("/accounts")
    expect(res.status).toBe(401)
  })

  it("rejects unauthenticated create", async () => {
    const res = await honoApp.request("/accounts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "X", type: "bank", currency: "UAH" }),
    })
    expect(res.status).toBe(401)
  })
})

describe("Accounts", () => {
  it("creates an account with initial balance", async () => {
    const account = await createAccountHttp({
      name: "Main Bank",
      type: "bank",
      currency: "UAH",
      balance: 1000,
    })

    expect(account.name).toBe("Main Bank")
    expect(account.type).toBe("bank")
    expect(account.currency).toBe("UAH")
    expect(account.balance).toBe(1000)
    expect(account.id).toBeDefined()
  })

  it("defaults balance to 0", async () => {
    const account = await createAccountHttp({
      name: "Cash",
      type: "bank",
      currency: "USD",
    })

    expect(account.balance).toBe(0)
  })

  it("lists accounts for user", async () => {
    await createAccountHttp({ name: "Bank", type: "bank", currency: "UAH" })
    await createAccountHttp({ name: "Cash", type: "bank", currency: "USD" })

    const accounts = await listAccountsHttp()

    expect(accounts).toHaveLength(2)
  })

  it("gets a single account", async () => {
    const created = await createAccountHttp({
      name: "Bank",
      type: "bank",
      currency: "UAH",
      balance: 500,
    })

    const account = await getAccountHttp(created.id)

    expect(account.id).toBe(created.id)
    expect(account.name).toBe("Bank")
    expect(account.balance).toBe(500)
  })

  it("updates an account", async () => {
    const created = await createAccountHttp({
      name: "Old Name",
      type: "bank",
      currency: "UAH",
    })

    const updated = await updateAccountHttp(created.id, {
      name: "New Name",
      type: "bank",
    })

    expect(updated.name).toBe("New Name")
    expect(updated.type).toBe("bank")
  })

  it("deletes an account", async () => {
    const created = await createAccountHttp({
      name: "To Delete",
      type: "bank",
      currency: "UAH",
    })

    await deleteAccountHttp(created.id)

    const accounts = await listAccountsHttp()
    expect(accounts).toHaveLength(0)
  })

  it("rejects deleting account with transactions", async () => {
    const account = await createAccountHttp({
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

    await createTransaction({
      organizationId,
      accountId: account.id,
      type: "expense",
      amount: 50,
      categoryId: category.id,
      date: new Date(),
      madeById: userId,
    })

    const res = await honoApp.request(`/accounts/${account.id}`, {
      method: "DELETE",
      headers: { cookie },
    })
    expect(res.status).toBe(409)
  })

  it("isolates accounts between users", async () => {
    await createAccountHttp({
      name: "User1 Bank",
      type: "bank",
      currency: "UAH",
    })

    const otherResult = await signupUser()
    const otherCookie = otherResult.cookie
    await createAccountHttp(
      { name: "User2 Bank", type: "bank", currency: "USD" },
      otherCookie
    )

    const user1Accounts = await listAccountsHttp()
    const user2Accounts = await listAccountsHttp(otherCookie)

    expect(user1Accounts).toHaveLength(1)
    expect(user2Accounts).toHaveLength(1)
    expect(user1Accounts[0].name).toBe("User1 Bank")
    expect(user2Accounts[0].name).toBe("User2 Bank")
  })

  describe("default account", () => {
    it("marks an account as the default for the current user", async () => {
      const a = await createAccountHttp({
        name: "Bank A",
        type: "bank",
        currency: "UAH",
      })
      const b = await createAccountHttp({
        name: "Bank B",
        type: "bank",
        currency: "UAH",
      })

      await setDefaultHttp(a.id)

      const list = await listAccountsHttp()
      const aRow = list.find((x) => x.id === a.id)!
      const bRow = list.find((x) => x.id === b.id)!
      expect(aRow.isDefault).toBe(true)
      expect(bRow.isDefault).toBe(false)
    })

    it("replaces the previous default when set on a different account", async () => {
      const a = await createAccountHttp({
        name: "Bank A",
        type: "bank",
        currency: "UAH",
      })
      const b = await createAccountHttp({
        name: "Bank B",
        type: "bank",
        currency: "UAH",
      })

      await setDefaultHttp(a.id)
      await setDefaultHttp(b.id)

      const list = await listAccountsHttp()
      expect(list.find((x) => x.id === a.id)!.isDefault).toBe(false)
      expect(list.find((x) => x.id === b.id)!.isDefault).toBe(true)
    })

    it("rejects setting default for an account in another org", async () => {
      const otherResult = await signupUser()
      const otherCookie = otherResult.cookie
      const foreign = await createAccountHttp(
        { name: "Foreign", type: "bank", currency: "USD" },
        otherCookie
      )

      const res = await honoApp.request(`/accounts/${foreign.id}/default`, {
        method: "PUT",
        headers: { cookie },
      })
      expect(res.status).toBe(404)
    })

    it("clears the default for the current user", async () => {
      const a = await createAccountHttp({
        name: "Bank A",
        type: "bank",
        currency: "UAH",
      })
      await setDefaultHttp(a.id)

      await clearDefaultHttp(a.id)

      const list = await listAccountsHttp()
      expect(list.find((x) => x.id === a.id)!.isDefault).toBe(false)
    })

    it("clearing when no default is set is a no-op", async () => {
      const a = await createAccountHttp({
        name: "Bank A",
        type: "bank",
        currency: "UAH",
      })

      await clearDefaultHttp(a.id)

      const list = await listAccountsHttp()
      expect(list.find((x) => x.id === a.id)!.isDefault).toBe(false)
    })

    it("clears default when the default account is deleted", async () => {
      const a = await createAccountHttp({
        name: "Bank A",
        type: "bank",
        currency: "UAH",
      })
      const b = await createAccountHttp({
        name: "Bank B",
        type: "bank",
        currency: "UAH",
      })
      await setDefaultHttp(a.id)

      await deleteAccountHttp(a.id)

      const list = await listAccountsHttp()
      expect(list.find((x) => x.id === a.id)).toBeUndefined()
      expect(list.find((x) => x.id === b.id)!.isDefault).toBe(false)
    })

    it("two users in the same org each see their own default", async () => {
      const { inviteCode } = await generateInviteCode(userId, organizationId)
      const second = await signupUser({ inviteCode })
      const secondCookie = second.cookie
      expect(second.organizationId).toBe(organizationId)

      const a = await createAccountHttp({
        name: "Bank A",
        type: "bank",
        currency: "UAH",
      })
      const b = await createAccountHttp({
        name: "Bank B",
        type: "bank",
        currency: "UAH",
      })

      await setDefaultHttp(a.id)
      await setDefaultHttp(b.id, secondCookie)

      const userOneList = await listAccountsHttp()
      const userTwoList = await listAccountsHttp(secondCookie)

      expect(userOneList.find((x) => x.id === a.id)!.isDefault).toBe(true)
      expect(userOneList.find((x) => x.id === b.id)!.isDefault).toBe(false)
      expect(userTwoList.find((x) => x.id === a.id)!.isDefault).toBe(false)
      expect(userTwoList.find((x) => x.id === b.id)!.isDefault).toBe(true)
    })
  })

  it("stores and returns a wallet card name", async () => {
    const createRes = await honoApp.request("/accounts", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({
        type: "bank",
        name: "Mono",
        currency: "UAH",
        cardLabel: "Mono Black",
      }),
    })
    expect(createRes.status).toBe(201)
    const created = (await createRes.json()) as {
      id: string
      cardLabel: string | null
    }
    expect(created.cardLabel).toBe("Mono Black")

    const clearRes = await honoApp.request(`/accounts/${created.id}`, {
      method: "PATCH",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ cardLabel: null }),
    })
    expect(clearRes.status).toBe(200)
    expect(
      ((await clearRes.json()) as { cardLabel: string | null }).cardLabel
    ).toBeNull()

    const setRes = await honoApp.request(`/accounts/${created.id}`, {
      method: "PATCH",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ cardLabel: "  Mono Black  " }),
    })
    expect(
      ((await setRes.json()) as { cardLabel: string | null }).cardLabel
    ).toBe("Mono Black")
  })

  it("defaults cardLabel to null", async () => {
    const res = await honoApp.request("/accounts", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ type: "bank", name: "Plain", currency: "UAH" }),
    })
    expect(
      ((await res.json()) as { cardLabel: string | null }).cardLabel
    ).toBeNull()
  })
})

describe("Accounts — brokerage balance", () => {
  beforeEach(() => {
    quoteMock.mockReset()
    quoteMock.mockResolvedValue([
      {
        symbol: "AAPL",
        longName: "Apple Inc.",
        fullExchangeName: "NasdaqGS",
        currency: "USD",
        regularMarketPrice: 200,
      },
    ])
  })

  async function postTrade(body: Record<string, unknown>) {
    return honoApp.request("/trades", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  }

  it("returns cash-only balance when brokerage has no trades", async () => {
    const account = await createAccountHttp({
      name: "IBKR",
      type: "brokerage",
      currency: "USD",
      balance: 5000,
    })
    const list = await listAccountsHttp()
    expect(list.find((a) => a.id === account.id)!.balance).toBeCloseTo(5000, 2)
  })

  it("rolls open-position market value into balance", async () => {
    const account = await createAccountHttp({
      name: "IBKR",
      type: "brokerage",
      currency: "USD",
      balance: 10_000,
    })
    const res = await postTrade({
      accountId: account.id,
      symbol: "AAPL",
      type: "buy",
      quantity: 10,
      price: 100,
      date: "2026-01-01T00:00:00Z",
    })
    expect(res.status).toBe(201)
    const list = await listAccountsHttp()
    // Cash: 10_000 - (10 × 100) = 9000. Holdings: 10 × 200 (mock) = 2000.
    expect(list.find((a) => a.id === account.id)!.balance).toBeCloseTo(
      11_000,
      2
    )
  })

  it("rolls holdings into balance when fetched by id", async () => {
    const account = await createAccountHttp({
      name: "IBKR",
      type: "brokerage",
      currency: "USD",
      balance: 10_000,
    })
    await postTrade({
      accountId: account.id,
      symbol: "AAPL",
      type: "buy",
      quantity: 10,
      price: 100,
      date: "2026-01-01T00:00:00Z",
    })
    // GET /accounts/:id recomputes holdings on its own path, not via the list.
    const fetched = await getAccountHttp(account.id)
    expect(fetched.balance).toBeCloseTo(11_000, 2)
  })

  it("rejects deleting a brokerage with an open position", async () => {
    const account = await createAccountHttp({
      name: "IBKR",
      type: "brokerage",
      currency: "USD",
      balance: 10_000,
    })
    await postTrade({
      accountId: account.id,
      symbol: "AAPL",
      type: "buy",
      quantity: 10,
      price: 100,
      date: "2026-01-01T00:00:00Z",
    })

    // Distinct from the transaction guard: this trips the open-position check.
    await deleteAccountHttp(account.id, cookie, 409)
  })

  it("rejects deleting a brokerage with closed trade history", async () => {
    const account = await createAccountHttp({
      name: "IBKR",
      type: "brokerage",
      currency: "USD",
      balance: 10_000,
    })
    await postTrade({
      accountId: account.id,
      symbol: "AAPL",
      type: "buy",
      quantity: 10,
      price: 100,
      date: "2026-01-01T00:00:00Z",
    })
    await postTrade({
      accountId: account.id,
      symbol: "AAPL",
      type: "sell",
      quantity: 10,
      price: 200,
      date: "2026-02-01T00:00:00Z",
    })

    // No open positions, but the trade rows remain — deletion still blocks.
    await deleteAccountHttp(account.id, cookie, 409)
  })

  it("deletes a brokerage that never traded", async () => {
    const account = await createAccountHttp({
      name: "IBKR",
      type: "brokerage",
      currency: "USD",
      balance: 5000,
    })

    await deleteAccountHttp(account.id)

    const list = await listAccountsHttp()
    expect(list.find((a) => a.id === account.id)).toBeUndefined()
  })

  it("excludes fully-closed positions from balance", async () => {
    const account = await createAccountHttp({
      name: "IBKR",
      type: "brokerage",
      currency: "USD",
      balance: 10_000,
    })
    await postTrade({
      accountId: account.id,
      symbol: "AAPL",
      type: "buy",
      quantity: 10,
      price: 100,
      date: "2026-01-01T00:00:00Z",
    })
    await postTrade({
      accountId: account.id,
      symbol: "AAPL",
      type: "sell",
      quantity: 10,
      price: 200,
      date: "2026-02-01T00:00:00Z",
    })
    const list = await listAccountsHttp()
    // Cash: 10_000 - 1000 + 2000 = 11_000. No open holdings.
    expect(list.find((a) => a.id === account.id)!.balance).toBeCloseTo(
      11_000,
      2
    )
  })

  it("leaves non-brokerage balances untouched", async () => {
    const bank = await createAccountHttp({
      name: "PKO",
      type: "bank",
      currency: "USD",
      balance: 1234,
    })
    const list = await listAccountsHttp()
    expect(list.find((a) => a.id === bank.id)!.balance).toBeCloseTo(1234, 2)
  })
})

interface WalletItem {
  id: string
  type: "wallet"
  name: string
  totalHomeBalance: number
  pockets: Array<{ accountId: string; currency: string; balance: number }>
}

describe("GET /accounts list shape", () => {
  it("returns leaf accounts in a flat list, never as wallet pockets", async () => {
    await createAccountHttp({ name: "Bank", type: "bank", currency: "UAH" })
    const res = await honoApp.request("/accounts", { headers: { cookie } })
    expect(res.status).toBe(200)
    const body = (await res.json()) as Array<{ type: string; name: string }>
    expect(body).toHaveLength(1)
    expect(body[0].type).toBe("bank")
    expect(body[0].name).toBe("Bank")
  })

  it("returns a wallet as a single entry with nested pockets and a home total", async () => {
    const today = new Date().toISOString().split("T")[0]
    await db
      .insert(exchangeRates)
      .values([{ date: today, base: "USD", target: "UAH", rate: 41 }])

    const walletRes = await honoApp.request("/accounts", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({
        type: "wallet",
        name: "Main",
        pockets: [{ currency: "USD", balance: 100 }],
      }),
    })
    expect(walletRes.status).toBe(201)
    const createdWallet = await walletRes.json()

    const res = await honoApp.request("/accounts", { headers: { cookie } })
    const body = (await res.json()) as Array<{ type: string }>
    // Exactly one entry (the wallet); pockets must not leak as leaf accounts.
    expect(body).toHaveLength(1)
    const wallets = body.filter((a): a is WalletItem => a.type === "wallet")
    expect(wallets).toHaveLength(1)
    expect(wallets[0].id).toBe(createdWallet.id)
    expect(wallets[0].name).toBe("Main")
    expect(wallets[0].pockets).toHaveLength(1)
    expect(wallets[0].pockets[0].currency).toBe("USD")
    expect(wallets[0].pockets[0].balance).toBe(100)
    expect(wallets[0].totalHomeBalance).toBeCloseTo(100 * 41, 2)
  })

  it("returns the wallet shape (pockets + home total) when fetched by id", async () => {
    const today = new Date().toISOString().split("T")[0]
    await db
      .insert(exchangeRates)
      .values([{ date: today, base: "USD", target: "UAH", rate: 41 }])

    const walletRes = await honoApp.request("/accounts", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({
        type: "wallet",
        name: "Main",
        pockets: [{ currency: "USD", balance: 100 }],
      }),
    })
    const createdWallet = await walletRes.json()

    // GET /accounts/:id dispatches to the wallet loader, not getAccount.
    const res = await honoApp.request(`/accounts/${createdWallet.id}`, {
      headers: { cookie },
    })
    expect(res.status).toBe(200)
    const wallet = (await res.json()) as WalletItem
    expect(wallet.type).toBe("wallet")
    expect(wallet.id).toBe(createdWallet.id)
    expect(wallet.pockets).toHaveLength(1)
    expect(wallet.pockets[0].currency).toBe("USD")
    expect(wallet.pockets[0].balance).toBe(100)
    expect(wallet.totalHomeBalance).toBeCloseTo(100 * 41, 2)
  })

  it("rejects creating a standalone account with an unsupported type", async () => {
    for (const type of ["wallet", "cash", "crypto"]) {
      const res = await honoApp.request("/accounts", {
        method: "POST",
        headers: { cookie, "content-type": "application/json" },
        // wallet here is missing `pockets`, so it matches neither union variant
        body: JSON.stringify({ name: "Orphan", type, currency: "USD" }),
      })
      expect(res.status).toBe(400)
    }
  })
})

describe("loan accounts", () => {
  it("stores positive balance input as a negative initialBalance and returns negative balance", async () => {
    const created = await createAccountHttp({
      name: "Car loan",
      type: "loan",
      currency: "UAH",
      balance: 250_000,
    })
    expect(created.type).toBe("loan")
    expect(created.balance).toBe(-250_000)
    expect(created.homeBalance).toBeLessThan(0)
  })

  it("creates a loan with zero owed amount when balance omitted", async () => {
    const created = await createAccountHttp({
      name: "Empty loan",
      type: "loan",
      currency: "UAH",
    })
    expect(created.balance).toBe(0)
  })

  it("reduces the loan's outstanding amount when a transfer credits it", async () => {
    const loan = await createAccountHttp({
      name: "Car loan",
      type: "loan",
      currency: "UAH",
      balance: 250_000,
    })
    const checking = await createAccountHttp({
      name: "Checking",
      type: "bank",
      currency: "UAH",
      balance: 100_000,
    })

    const res = await honoApp.request("/transactions/transfers", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({
        fromAccountId: checking.id,
        toAccountId: loan.id,
        amount: 27_000,
        date: new Date().toISOString(),
      }),
    })
    expect(res.status).toBe(201)

    const loanAfter = await getAccountHttp(loan.id)
    expect(loanAfter.balance).toBe(-223_000)

    const checkingAfter = await getAccountHttp(checking.id)
    expect(checkingAfter.balance).toBe(73_000)
  })

  it("normalizes a negative input balance for a loan (treats sign as already-owed)", async () => {
    const created = await createAccountHttp({
      name: "Negative-input loan",
      type: "loan",
      currency: "UAH",
      balance: -1_000,
    })
    expect(created.balance).toBe(-1_000)
  })
})
