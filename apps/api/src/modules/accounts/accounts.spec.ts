import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  it,
  expect,
} from "bun:test"
import { env } from "@workspace/env/api"
import type { Account } from "@workspace/api-contract"
import { honoApp } from "@/app"
import { signAccessToken } from "@/modules/auth/core/jwt"
import { ACCESS_TOKEN_COOKIE } from "@/modules/auth/core/cookies"
import { generateInviteCodeService } from "@/modules/auth/service"
import { listCategories } from "@/modules/categories/service"
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

function cookieHeader(jwt: string): string {
  return `${ACCESS_TOKEN_COOKIE}=${jwt}`
}

function buildCookie(payload: {
  sub: string
  email: string
  organizationId: string
}): string {
  const jwt = signAccessToken(payload, env.JWT_SECRET, env.JWT_EXPIRATION)
  return cookieHeader(jwt)
}

beforeAll(async () => {
  await createTestApp()
})

afterAll(() => closeTestApp())

beforeEach(async () => {
  await truncateAll()
  const result = await signupUser()
  organizationId = result.accessToken.organizationId
  userId = result.accessToken.sub
  cookie = buildCookie(result.accessToken)
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
  expectedStatus = 201,
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
  cookieValue: string = cookie,
): Promise<Account[]> {
  const res = await honoApp.request("/accounts", {
    headers: { cookie: cookieValue },
  })
  expect(res.status).toBe(200)
  return res.json()
}

async function getAccountHttp(
  id: string,
  cookieValue: string = cookie,
  expectedStatus = 200,
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
  expectedStatus = 200,
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
  expectedStatus = 200,
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
  expectedStatus = 200,
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
  expectedStatus = 200,
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
      type: "cash",
      currency: "USD",
    })

    expect(account.balance).toBe(0)
  })

  it("lists accounts for user", async () => {
    await createAccountHttp({ name: "Bank", type: "bank", currency: "UAH" })
    await createAccountHttp({ name: "Cash", type: "cash", currency: "USD" })

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
      type: "cash",
    })

    expect(updated.name).toBe("New Name")
    expect(updated.type).toBe("cash")
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

    const categories = await listCategories(organizationId)

    await createTransaction({
      organizationId,
      accountId: account.id,
      type: "expense",
      amount: 50,
      categoryId: categories[0].id,
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
    const otherCookie = buildCookie(otherResult.accessToken)
    await createAccountHttp(
      { name: "User2 Bank", type: "bank", currency: "USD" },
      otherCookie,
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
      const otherCookie = buildCookie(otherResult.accessToken)
      const foreign = await createAccountHttp(
        { name: "Foreign", type: "bank", currency: "USD" },
        otherCookie,
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
      const { inviteCode } = await generateInviteCodeService(
        userId,
        organizationId,
      )
      const second = await signupUser({ inviteCode })
      const secondCookie = buildCookie(second.accessToken)
      expect(second.accessToken.organizationId).toBe(organizationId)

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
      2,
    )
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
      2,
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
