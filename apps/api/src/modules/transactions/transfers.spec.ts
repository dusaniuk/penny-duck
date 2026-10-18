import { beforeAll, afterAll, beforeEach, describe, it, expect } from "bun:test"
import type { Account, Transaction } from "@workspace/api-contract"
import { honoApp } from "@/app"
import { createAccount, getAccount } from "@/modules/accounts/service"
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
  expectedStatus = 201
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
  expectedStatus = 200
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
  expectedStatus = 200
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
  expectedStatus = 200
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
      400
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

  it("rejects partial exchange-rate fields on update", async () => {
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

    const { outgoing } = await createTransferHttp({
      fromAccountId: usd.id,
      toAccountId: uah.id,
      amount: 100,
      originalAmount: 4152,
      originalCurrency: "UAH",
      exchangeRate: 41.52,
    })
    const transferId = outgoing.transferId!

    await updateTransferHttp(transferId, { exchangeRate: 40 }, 400)
    await updateTransferHttp(
      transferId,
      { amount: 200, originalAmount: 8000 },
      400
    )
    await updateTransferHttp(
      transferId,
      { originalAmount: 4000, originalCurrency: null, exchangeRate: 40 },
      400
    )

    const { outgoing: out, incoming } = await updateTransferHttp(transferId, {
      note: "still there",
    })
    expect(out.amount).toBe(100)
    expect(out.exchangeRate).toBe(41.52)
    expect(incoming.amount).toBe(4152)
  })

  it("rejects clearing the exchange rate on a cross-currency transfer", async () => {
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

    const { outgoing } = await createTransferHttp({
      fromAccountId: usd.id,
      toAccountId: uah.id,
      amount: 100,
      originalAmount: 4152,
      originalCurrency: "UAH",
      exchangeRate: 41.52,
    })

    await updateTransferHttp(
      outgoing.transferId!,
      { originalAmount: null, originalCurrency: null, exchangeRate: null },
      400
    )
  })

  it("clears the exchange rate on a same-currency transfer", async () => {
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
      balance: 0,
    })

    const { outgoing } = await createTransferHttp({
      fromAccountId: acc1.id,
      toAccountId: acc2.id,
      amount: 100,
      originalAmount: 100,
      originalCurrency: "UAH",
      exchangeRate: 1,
    })

    const { outgoing: out, incoming } = await updateTransferHttp(
      outgoing.transferId!,
      { originalAmount: null, originalCurrency: null, exchangeRate: null }
    )
    expect(out.exchangeRate).toBeNull()
    expect(incoming.amount).toBe(100)
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

  it("pages an account view with paired halves outside the limit", async () => {
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
      balance: 0,
    })

    const outgoingIds: string[] = []
    for (let i = 0; i < 5; i++) {
      const { outgoing } = await createTransferHttp({
        fromAccountId: acc1.id,
        toAccountId: acc2.id,
        amount: 100,
        date: new Date(Date.UTC(2026, 0, i + 1)).toISOString(),
      })
      outgoingIds.push(outgoing.id)
    }

    const limit = 2
    const pages: { data: Transaction[]; total: number }[] = []
    let page = 1
    do {
      const res = await honoApp.request(
        `/transactions?accountId=${acc1.id}&page=${page}&limit=${limit}`,
        { headers: { cookie } }
      )
      expect(res.status).toBe(200)
      pages.push(await res.json())
      page++
    } while ((page - 1) * limit < pages[0].total)

    expect(pages[0].total).toBe(5)
    expect(pages).toHaveLength(3)

    const ownRows = pages.flatMap((p) =>
      p.data.filter((t) => t.accountId === acc1.id)
    )
    expect(ownRows.map((t) => t.id).sort()).toEqual(outgoingIds.sort())

    for (const p of pages) {
      const own = p.data.filter((t) => t.accountId === acc1.id)
      expect(own.length).toBeLessThanOrEqual(limit)
      expect(p.data).toHaveLength(own.length * 2)
    }

    const rowCount = pages.reduce((sum, p) => sum + p.data.length, 0)
    expect(rowCount).toBeGreaterThan(pages[0].total)
  })
})
