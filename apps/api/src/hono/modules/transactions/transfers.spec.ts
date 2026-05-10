import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  it,
  expect,
} from "vitest"
import { env } from "@workspace/env/api"
import type { Account, Transaction } from "@workspace/api-contract"
import { honoApp } from "@/hono/app"
import { signAccessToken } from "@/auth/core/jwt"
import { ACCESS_TOKEN_COOKIE } from "@/auth/core/cookies"
import {
  createAccount,
  getAccount,
} from "@/hono/modules/accounts/service"
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

interface TransferBody {
  fromAccountId: string
  toAccountId: string
  amount: number
  date?: string
  note?: string | null
  originalAmount?: number
  originalCurrency?: string
  exchangeRate?: number
  madeById?: string
}

async function createTransferHttp(
  body: TransferBody,
  expectedStatus = 201,
): Promise<{ outgoing: Transaction; incoming: Transaction }> {
  const res = await honoApp.request("/transactions/transfers", {
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

async function updateTransferHttp(
  transferId: string,
  body: Record<string, unknown>,
  expectedStatus = 200,
): Promise<{ outgoing: Transaction; incoming: Transaction }> {
  const res = await honoApp.request(`/transactions/transfers/${transferId}`, {
    method: "PATCH",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  expect(res.status).toBe(expectedStatus)
  return res.json()
}

async function deleteTransferHttp(
  transferId: string,
  expectedStatus = 200,
): Promise<Response> {
  const res = await honoApp.request(`/transactions/transfers/${transferId}`, {
    method: "DELETE",
    headers: { cookie },
  })
  expect(res.status).toBe(expectedStatus)
  return res
}

async function deleteTxHttp(
  id: string,
  expectedStatus = 200,
): Promise<Response> {
  const res = await honoApp.request(`/transactions/${id}`, {
    method: "DELETE",
    headers: { cookie },
  })
  expect(res.status).toBe(expectedStatus)
  return res
}

async function getAccountBalance(id: string): Promise<Account> {
  return getAccount(id, organizationId, userId)
}

describe("Transfers", () => {
  it("creates a same-currency transfer", async () => {
    const acc1 = await createAccount({
      organizationId,
      userId,
      name: "Bank 1",
      type: "bank",
      currency: "UAH",
      balance: 5000,
    })
    const acc2 = await createAccount({
      organizationId,
      userId,
      name: "Bank 2",
      type: "bank",
      currency: "UAH",
      balance: 1000,
    })

    const { outgoing, incoming } = await createTransferHttp({
      fromAccountId: acc1.id,
      toAccountId: acc2.id,
      amount: 500,
    })

    expect(outgoing.accountId).toBe(acc1.id)
    expect(outgoing.amount).toBe(500)
    expect(outgoing.type).toBe("expense")
    expect(incoming.accountId).toBe(acc2.id)
    expect(incoming.amount).toBe(500)
    expect(incoming.type).toBe("income")
    expect(outgoing.transferId).toBe(incoming.transferId)

    const a1 = await getAccountBalance(acc1.id)
    const a2 = await getAccountBalance(acc2.id)
    expect(a1.balance).toBe(4500)
    expect(a2.balance).toBe(1500)
  })

  it("creates a cross-currency transfer", async () => {
    const usd = await createAccount({
      organizationId,
      userId,
      name: "USD",
      type: "bank",
      currency: "USD",
      balance: 1000,
    })
    const uah = await createAccount({
      organizationId,
      userId,
      name: "UAH",
      type: "bank",
      currency: "UAH",
      balance: 0,
    })

    const { outgoing, incoming } = await createTransferHttp({
      fromAccountId: usd.id,
      toAccountId: uah.id,
      amount: 100,
      originalAmount: 4152,
      originalCurrency: "UAH",
      exchangeRate: 41.52,
    })

    expect(outgoing.amount).toBe(100)
    expect(outgoing.exchangeRate).toBe(41.52)
    expect(incoming.amount).toBe(4152)

    const u = await getAccountBalance(usd.id)
    const h = await getAccountBalance(uah.id)
    expect(u.balance).toBe(900)
    expect(h.balance).toBe(4152)
  })

  it("rejects transfer to same account", async () => {
    const acc = await createAccount({
      organizationId,
      userId,
      name: "Bank",
      type: "bank",
      currency: "UAH",
      balance: 5000,
    })

    await createTransferHttp(
      {
        fromAccountId: acc.id,
        toAccountId: acc.id,
        amount: 100,
      },
      400,
    )
  })

  it("updates a transfer", async () => {
    const acc1 = await createAccount({
      organizationId,
      userId,
      name: "Bank 1",
      type: "bank",
      currency: "UAH",
      balance: 5000,
    })
    const acc2 = await createAccount({
      organizationId,
      userId,
      name: "Bank 2",
      type: "bank",
      currency: "UAH",
      balance: 1000,
    })

    const { outgoing } = await createTransferHttp({
      fromAccountId: acc1.id,
      toAccountId: acc2.id,
      amount: 500,
    })

    const { outgoing: updatedOut, incoming: updatedIn } =
      await updateTransferHttp(outgoing.transferId!, {
        amount: 300,
        note: "adjusted",
      })

    expect(updatedOut.amount).toBe(300)
    expect(updatedOut.note).toBe("adjusted")
    expect(updatedIn.amount).toBe(300)
    expect(updatedIn.note).toBe("adjusted")
  })

  it("deletes a transfer and restores balances", async () => {
    const acc1 = await createAccount({
      organizationId,
      userId,
      name: "Bank 1",
      type: "bank",
      currency: "UAH",
      balance: 5000,
    })
    const acc2 = await createAccount({
      organizationId,
      userId,
      name: "Bank 2",
      type: "bank",
      currency: "UAH",
      balance: 1000,
    })

    const { outgoing } = await createTransferHttp({
      fromAccountId: acc1.id,
      toAccountId: acc2.id,
      amount: 500,
    })

    await deleteTransferHttp(outgoing.transferId!)

    const a1 = await getAccountBalance(acc1.id)
    const a2 = await getAccountBalance(acc2.id)
    expect(a1.balance).toBe(5000)
    expect(a2.balance).toBe(1000)
  })

  it("rejects deleting transfer via regular transaction endpoint", async () => {
    const acc1 = await createAccount({
      organizationId,
      userId,
      name: "Bank 1",
      type: "bank",
      currency: "UAH",
      balance: 5000,
    })
    const acc2 = await createAccount({
      organizationId,
      userId,
      name: "Bank 2",
      type: "bank",
      currency: "UAH",
      balance: 1000,
    })

    const { outgoing } = await createTransferHttp({
      fromAccountId: acc1.id,
      toAccountId: acc2.id,
      amount: 500,
    })

    await deleteTxHttp(outgoing.id, 400)
  })
})
