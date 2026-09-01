import { beforeAll, afterAll, beforeEach, describe, it, expect } from "bun:test"
import { env } from "@workspace/env/api"
import type { Account, Transaction } from "@workspace/api-contract"
import { honoApp } from "@/app"
import { signAccessToken } from "@/modules/auth/core/jwt"
import { ACCESS_TOKEN_COOKIE } from "@/modules/auth/core/cookies"
import { createCategory } from "@/modules/categories/service"
import { createAccount, getAccount } from "@/modules/accounts/service"
import {
  closeTestApp,
  createTestApp,
  flushEvents,
  signupUser,
  truncateAll,
} from "@/test/setup"

let cookie: string
let organizationId: string
let userId: string
let accountId: string
let categoryId: string

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
  await flushEvents()

  const account = await createAccount({
    organizationId,
    userId,
    name: "Bank",
    type: "bank",
    currency: "UAH",
    balance: 10000,
  })
  accountId = account.id

  const category = await createCategory({
    organizationId,
    name: "Groceries",
    parentId: null,
    icon: "cart",
    type: "expense",
    color: "red",
  })
  categoryId = category.id
})

interface CreateTxBody {
  accountId: string
  type: "expense" | "income"
  amount: number
  categoryId: string
  date?: string
  note?: string | null
  settled?: boolean
  originalAmount?: number
  originalCurrency?: string
  exchangeRate?: number
  madeById?: string
}

async function createTxHttp(
  body: Partial<CreateTxBody> & {
    accountId: string
    type: "expense" | "income"
    amount: number
    categoryId: string
  },
  expectedStatus = 201
): Promise<Transaction> {
  const res = await honoApp.request("/transactions", {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({
      date: new Date().toISOString(),
      ...body,
    }),
  })
  expect(res.status).toBe(expectedStatus)
  return res.json()
}

async function getTxHttp(
  id: string,
  expectedStatus = 200
): Promise<Transaction> {
  const res = await honoApp.request(`/transactions/${id}`, {
    headers: { cookie },
  })
  expect(res.status).toBe(expectedStatus)
  return res.json()
}

async function listTxHttp(
  query: Record<string, string | number | boolean> = {}
): Promise<{
  data: Transaction[]
  total: number
  page: number
  limit: number
}> {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) params.set(k, String(v))
  const qs = params.toString() ? `?${params.toString()}` : ""
  const res = await honoApp.request(`/transactions${qs}`, {
    headers: { cookie },
  })
  expect(res.status).toBe(200)
  return res.json()
}

async function updateTxHttp(
  id: string,
  body: Record<string, unknown>,
  expectedStatus = 200
): Promise<Transaction> {
  const res = await honoApp.request(`/transactions/${id}`, {
    method: "PATCH",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  expect(res.status).toBe(expectedStatus)
  return res.json()
}

async function deleteTxHttp(
  id: string,
  expectedStatus = 200
): Promise<Response> {
  const res = await honoApp.request(`/transactions/${id}`, {
    method: "DELETE",
    headers: { cookie },
  })
  expect(res.status).toBe(expectedStatus)
  return res
}

async function settleTxHttp(
  id: string,
  expectedStatus = 200
): Promise<Transaction> {
  const res = await honoApp.request(`/transactions/${id}/settle`, {
    method: "PATCH",
    headers: { cookie },
  })
  expect(res.status).toBe(expectedStatus)
  return res.json()
}

interface ReimburseBody {
  accountId: string
  amount: number
  date?: string
  exchangeRate?: number
  madeById?: string
}

async function reimburseHttp(
  txId: string,
  body: ReimburseBody,
  expectedStatus = 201
): Promise<Transaction> {
  const res = await honoApp.request(`/transactions/${txId}/reimburse`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({
      date: new Date().toISOString(),
      ...body,
    }),
  })
  expect(res.status).toBe(expectedStatus)
  return res.json()
}

async function deleteReimburseHttp(
  txId: string,
  reimbursementTxId: string,
  expectedStatus = 200
): Promise<Response> {
  const res = await honoApp.request(
    `/transactions/${txId}/reimburse/${reimbursementTxId}`,
    {
      method: "DELETE",
      headers: { cookie },
    }
  )
  expect(res.status).toBe(expectedStatus)
  return res
}

async function getAccountBalance(id: string): Promise<Account> {
  return getAccount(id, organizationId, userId)
}

describe("Transactions — auth", () => {
  it("rejects unauthenticated list", async () => {
    const res = await honoApp.request("/transactions")
    expect(res.status).toBe(401)
  })

  it("rejects unauthenticated create", async () => {
    const res = await honoApp.request("/transactions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        accountId,
        type: "expense",
        amount: 10,
        categoryId,
        date: new Date().toISOString(),
      }),
    })
    expect(res.status).toBe(401)
  })
})

describe("Transactions", () => {
  it("creates an expense transaction", async () => {
    const tx = await createTxHttp({
      accountId,
      type: "expense",
      amount: 50.25,
      categoryId,
      note: "lunch",
    })

    expect(tx.id).toBeDefined()
    expect(tx.type).toBe("expense")
    expect(tx.amount).toBe(50.25)
    expect(tx.note).toBe("lunch")
    expect(tx.settled).toBe(true)
  })

  it("creates an income transaction", async () => {
    const tx = await createTxHttp({
      accountId,
      type: "income",
      amount: 1000,
      categoryId,
    })

    expect(tx.type).toBe("income")
    expect(tx.amount).toBe(1000)
  })

  it("toggles settled on a transaction", async () => {
    const tx = await createTxHttp({
      accountId,
      type: "expense",
      amount: 100,
      categoryId,
    })
    expect(tx.settled).toBe(true)

    const unsettled = await settleTxHttp(tx.id)
    expect(unsettled.settled).toBe(false)
  })

  it("creates a transaction with exchange rate", async () => {
    const tx = await createTxHttp({
      accountId,
      type: "expense",
      amount: 100,
      categoryId,
      originalAmount: 4152,
      originalCurrency: "UAH",
      exchangeRate: 41.52,
    })

    expect(tx.originalAmount).toBe(4152)
    expect(tx.originalCurrency).toBe("UAH")
    expect(tx.exchangeRate).toBe(41.52)
  })

  it("gets a single transaction", async () => {
    const created = await createTxHttp({
      accountId,
      type: "expense",
      amount: 50,
      categoryId,
    })

    const found = await getTxHttp(created.id)
    expect(found.id).toBe(created.id)
    expect(found.amount).toBe(50)
  })

  it("lists transactions with pagination", async () => {
    for (let i = 0; i < 3; i++) {
      await createTxHttp({
        accountId,
        type: "expense",
        amount: 10 * (i + 1),
        categoryId,
      })
    }

    const result = await listTxHttp({ page: 1, limit: 10 })
    expect(result.data).toHaveLength(3)
    expect(result.total).toBe(3)
  })

  it("filters transactions by type", async () => {
    await createTxHttp({ accountId, type: "expense", amount: 50, categoryId })
    await createTxHttp({ accountId, type: "income", amount: 100, categoryId })

    const result = await listTxHttp({ page: 1, limit: 10, type: "expense" })
    expect(result.data).toHaveLength(1)
    expect(result.data[0].type).toBe("expense")
  })

  it("filters transactions by settled status", async () => {
    const unsettledTx = await createTxHttp({
      accountId,
      type: "expense",
      amount: 100,
      categoryId,
    })
    await settleTxHttp(unsettledTx.id)

    await createTxHttp({ accountId, type: "expense", amount: 50, categoryId })

    const result = await listTxHttp({ page: 1, limit: 10, settled: false })
    expect(result.data).toHaveLength(1)
    expect(result.data[0].settled).toBe(false)
  })

  it("updates a transaction", async () => {
    const created = await createTxHttp({
      accountId,
      type: "expense",
      amount: 50,
      categoryId,
    })

    const updated = await updateTxHttp(created.id, {
      amount: 75,
      note: "updated",
    })
    expect(updated.amount).toBe(75)
    expect(updated.note).toBe("updated")
  })

  it("deletes a transaction", async () => {
    const created = await createTxHttp({
      accountId,
      type: "expense",
      amount: 50,
      categoryId,
    })

    await deleteTxHttp(created.id)
    await getTxHttp(created.id, 404)
  })

  it("settles an unsettled transaction", async () => {
    const created = await createTxHttp({
      accountId,
      type: "expense",
      amount: 100,
      categoryId,
    })

    await settleTxHttp(created.id) // → unsettled
    const settled = await settleTxHttp(created.id) // → settled
    expect(settled.settled).toBe(true)
  })

  it("updates account balance on expense", async () => {
    await createTxHttp({
      accountId,
      type: "expense",
      amount: 200,
      categoryId,
    })

    const account = await getAccountBalance(accountId)
    expect(account.balance).toBe(9800)
  })

  it("updates account balance on income", async () => {
    await createTxHttp({
      accountId,
      type: "income",
      amount: 500,
      categoryId,
    })

    const account = await getAccountBalance(accountId)
    expect(account.balance).toBe(10500)
  })

  it("moves balance when changing accountId", async () => {
    const account2 = await createAccount({
      organizationId,
      userId,
      name: "Cash",
      type: "wallet",
      currency: "UAH",
      balance: 5000,
    })

    const tx = await createTxHttp({
      accountId,
      type: "expense",
      amount: 200,
      categoryId,
    })

    const updated = await updateTxHttp(tx.id, { accountId: account2.id })
    expect(updated.accountId).toBe(account2.id)

    const orig = await getAccountBalance(accountId)
    expect(orig.balance).toBe(10000)

    const dest = await getAccountBalance(account2.id)
    expect(dest.balance).toBe(4800)
  })

  it("moves balance correctly when changing accountId and amount together", async () => {
    const account2 = await createAccount({
      organizationId,
      userId,
      name: "Cash",
      type: "wallet",
      currency: "UAH",
      balance: 5000,
    })

    const tx = await createTxHttp({
      accountId,
      type: "expense",
      amount: 200,
      categoryId,
    })

    await updateTxHttp(tx.id, { accountId: account2.id, amount: 300 })

    const orig = await getAccountBalance(accountId)
    expect(orig.balance).toBe(10000)

    const dest = await getAccountBalance(account2.id)
    expect(dest.balance).toBe(4700)
  })

  it("moves balance correctly when changing accountId on income", async () => {
    const account2 = await createAccount({
      organizationId,
      userId,
      name: "Cash",
      type: "wallet",
      currency: "UAH",
      balance: 5000,
    })

    const tx = await createTxHttp({
      accountId,
      type: "income",
      amount: 500,
      categoryId,
    })

    await updateTxHttp(tx.id, { accountId: account2.id })

    const orig = await getAccountBalance(accountId)
    expect(orig.balance).toBe(10000)

    const dest = await getAccountBalance(account2.id)
    expect(dest.balance).toBe(5500)
  })

  it("reverses balance on delete", async () => {
    const tx = await createTxHttp({
      accountId,
      type: "expense",
      amount: 200,
      categoryId,
    })

    await deleteTxHttp(tx.id)

    const account = await getAccountBalance(accountId)
    expect(account.balance).toBe(10000)
  })

  it("creates a same-account reimbursement", async () => {
    const tx = await createTxHttp({
      accountId,
      type: "expense",
      amount: 100,
      categoryId,
    })

    const updated = await reimburseHttp(tx.id, {
      accountId,
      amount: 30,
    })

    expect(updated.amount).toBe(70)
    expect(updated.type).toBe("expense")

    const account = await getAccountBalance(accountId)
    expect(account.balance).toBe(9930)
  })

  it("creates a cross-account same-currency reimbursement", async () => {
    const account2 = await createAccount({
      organizationId,
      userId,
      name: "Cash",
      type: "wallet",
      currency: "UAH",
      balance: 5000,
    })

    const tx = await createTxHttp({
      accountId,
      type: "expense",
      amount: 100,
      categoryId,
    })

    const updated = await reimburseHttp(tx.id, {
      accountId: account2.id,
      amount: 30,
    })

    expect(updated.amount).toBe(70)

    const acc1 = await getAccountBalance(accountId)
    expect(acc1.balance).toBe(9900)

    const acc2 = await getAccountBalance(account2.id)
    expect(acc2.balance).toBe(5030)
  })

  it("creates a cross-currency reimbursement", async () => {
    const plnAccount = await createAccount({
      organizationId,
      userId,
      name: "PLN Bank",
      type: "bank",
      currency: "PLN",
      balance: 1000,
    })
    const uahAccount = await createAccount({
      organizationId,
      userId,
      name: "UAH Bank",
      type: "bank",
      currency: "UAH",
      balance: 0,
    })

    const tx = await createTxHttp({
      accountId: plnAccount.id,
      type: "expense",
      amount: 100,
      categoryId,
    })

    const updated = await reimburseHttp(tx.id, {
      accountId: uahAccount.id,
      amount: 300,
      exchangeRate: 0.1,
    })

    expect(updated.amount).toBe(70)

    const pln = await getAccountBalance(plnAccount.id)
    expect(pln.balance).toBe(900)

    const uah = await getAccountBalance(uahAccount.id)
    expect(uah.balance).toBe(300)
  })

  it("rejects reimbursement exceeding expense amount", async () => {
    const tx = await createTxHttp({
      accountId,
      type: "expense",
      amount: 100,
      categoryId,
    })

    await reimburseHttp(tx.id, { accountId, amount: 100 }, 400)
  })

  it("rejects reimbursement on income transaction", async () => {
    const tx = await createTxHttp({
      accountId,
      type: "income",
      amount: 100,
      categoryId,
    })

    await reimburseHttp(tx.id, { accountId, amount: 50 }, 400)
  })

  it("rejects cross-currency reimbursement without exchange rate", async () => {
    const uahAccount = await createAccount({
      organizationId,
      userId,
      name: "UAH",
      type: "bank",
      currency: "UAH",
      balance: 0,
    })
    const plnAccount = await createAccount({
      organizationId,
      userId,
      name: "PLN",
      type: "bank",
      currency: "PLN",
      balance: 1000,
    })

    const tx = await createTxHttp({
      accountId: plnAccount.id,
      type: "expense",
      amount: 100,
      categoryId,
    })

    await reimburseHttp(tx.id, { accountId: uahAccount.id, amount: 300 }, 400)
  })

  it("deletes a cross-account reimbursement and restores expense amount", async () => {
    const account2 = await createAccount({
      organizationId,
      userId,
      name: "Cash",
      type: "wallet",
      currency: "UAH",
      balance: 5000,
    })

    const tx = await createTxHttp({
      accountId,
      type: "expense",
      amount: 100,
      categoryId,
    })

    await reimburseHttp(tx.id, { accountId: account2.id, amount: 30 })

    const list = await listTxHttp({
      page: 1,
      limit: 100,
      accountId: account2.id,
    })
    const reimbursementTx = list.data.find((t) => t.reimbursementId === tx.id)

    await deleteReimburseHttp(tx.id, reimbursementTx!.id)

    const restored = await getTxHttp(tx.id)
    expect(restored.amount).toBe(100)

    const acc1 = await getAccountBalance(accountId)
    expect(acc1.balance).toBe(9900)

    const acc2 = await getAccountBalance(account2.id)
    expect(acc2.balance).toBe(5000)
  })

  it("hides reimbursement transfers from main transaction list", async () => {
    const account2 = await createAccount({
      organizationId,
      userId,
      name: "Cash",
      type: "wallet",
      currency: "UAH",
      balance: 5000,
    })

    const tx = await createTxHttp({
      accountId,
      type: "expense",
      amount: 100,
      categoryId,
    })

    await reimburseHttp(tx.id, { accountId: account2.id, amount: 30 })

    const mainList = await listTxHttp({ page: 1, limit: 100 })
    expect(mainList.data).toHaveLength(1)
    expect(mainList.data[0].amount).toBe(70)

    const accountList = await listTxHttp({
      page: 1,
      limit: 100,
      accountId: account2.id,
    })
    expect(accountList.data).toHaveLength(1)
    expect(accountList.data[0].amount).toBe(30)
    expect(accountList.data[0].reimbursementId).toBe(tx.id)

    const expenseAccountList = await listTxHttp({
      page: 1,
      limit: 100,
      accountId,
    })
    expect(expenseAccountList.data).toHaveLength(1)
    expect(expenseAccountList.data[0].id).toBe(tx.id)
    expect(expenseAccountList.data[0].amount).toBe(70)
  })

  it("deleting an expense cascades to its reimbursement transfers", async () => {
    const account2 = await createAccount({
      organizationId,
      userId,
      name: "Cash",
      type: "wallet",
      currency: "UAH",
      balance: 5000,
    })

    const tx = await createTxHttp({
      accountId,
      type: "expense",
      amount: 100,
      categoryId,
    })

    await reimburseHttp(tx.id, { accountId: account2.id, amount: 30 })

    await deleteTxHttp(tx.id)

    const list = await listTxHttp({ page: 1, limit: 100 })
    expect(list.data).toHaveLength(0)

    const acc1 = await getAccountBalance(accountId)
    expect(acc1.balance).toBe(10000)

    const acc2 = await getAccountBalance(account2.id)
    expect(acc2.balance).toBe(5000)
  })
})

describe("Transactions — cross-tenant isolation", () => {
  // An account owned by a DIFFERENT organization than the authenticated user.
  async function otherOrgAccount(): Promise<string> {
    const victim = await signupUser()
    const account = await createAccount({
      organizationId: victim.accessToken.organizationId,
      userId: victim.accessToken.sub,
      name: "Victim Bank",
      type: "bank",
      currency: "UAH",
      balance: 999999,
    })
    return account.id
  }

  it("rejects creating a transaction on another org's account", async () => {
    const victimAccountId = await otherOrgAccount()
    await createTxHttp(
      { accountId: victimAccountId, type: "expense", amount: 50, categoryId },
      404
    )
  })

  it("rejects reassigning a transaction onto another org's account", async () => {
    const victimAccountId = await otherOrgAccount()
    const tx = await createTxHttp({
      accountId,
      type: "expense",
      amount: 50,
      categoryId,
    })
    await updateTxHttp(tx.id, { accountId: victimAccountId }, 404)
  })
})
