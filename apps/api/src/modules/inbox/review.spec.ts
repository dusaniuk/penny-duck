import { beforeEach, describe, expect, it, spyOn } from "bun:test"
import { eq } from "drizzle-orm"
import {
  accounts,
  exchangeRates,
  transactions,
  walletInbox,
} from "@workspace/db"
import type { InboxItem, Transaction } from "@workspace/api-contract"
import { honoApp } from "@/app"
import { db } from "@/db"
import { createAccount } from "@/modules/accounts/service"
import { createCategory } from "@/modules/categories/service"
import * as transactionsService from "@/modules/transactions/service"
import { signupUser, truncateAll, type TestUser } from "@/test/setup"
import { ingestWalletTap } from "./service"

let user: TestUser
let uahAccountId: string
let usdAccountId: string
let categoryId: string

async function seedTap(
  overrides: Partial<Parameters<typeof ingestWalletTap>[0]> = {}
) {
  const { item } = await ingestWalletTap({
    organizationId: user.organizationId,
    userId: user.userId,
    card: "Mono Black",
    merchant: "Silpo",
    description: "SILPO KYIV",
    amount: 123.45,
    currency: "UAH",
    occurredAt: new Date("2026-10-13T07:15:00Z"),
    ...overrides,
  })
  return item
}

function authed(path: string, init: RequestInit = {}) {
  return honoApp.request(path, {
    ...init,
    headers: {
      cookie: user.cookie,
      "content-type": "application/json",
      ...(init.headers ?? {}),
    },
  })
}

function accept(id: string, body: unknown) {
  return authed(`/inbox/${id}/accept`, {
    method: "POST",
    body: JSON.stringify(body),
  })
}

beforeEach(async () => {
  await truncateAll()
  user = await signupUser()
  uahAccountId = (
    await createAccount({
      organizationId: user.organizationId,
      userId: user.userId,
      name: "Mono",
      type: "bank",
      currency: "UAH",
      cardLabel: "Mono Black",
    })
  ).id
  usdAccountId = (
    await createAccount({
      organizationId: user.organizationId,
      userId: user.userId,
      name: "Wise USD",
      type: "bank",
      currency: "USD",
    })
  ).id
  categoryId = (
    await createCategory({
      organizationId: user.organizationId,
      name: "Groceries",
      parentId: null,
      icon: "cart",
      type: "expense",
      color: "red",
    })
  ).id
})

describe("GET /inbox", () => {
  it("requires a session", async () => {
    const res = await honoApp.request("/inbox")
    expect(res.status).toBe(401)
  })

  it("lists pending rows newest first with pagination", async () => {
    const older = await seedTap({
      occurredAt: new Date("2026-10-12T09:00:00Z"),
    })
    const newer = await seedTap({
      occurredAt: new Date("2026-10-13T09:00:00Z"),
    })
    await seedTap({
      card: "Other",
      occurredAt: new Date("2026-10-11T09:00:00Z"),
    })
    await db
      .update(walletInbox)
      .set({ status: "dismissed" })
      .where(eq(walletInbox.card, "Other"))

    const res = await authed("/inbox?status=pending&limit=1")
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      data: InboxItem[]
      total: number
      page: number
      limit: number
    }
    expect(body.total).toBe(2)
    expect(body.page).toBe(1)
    expect(body.limit).toBe(1)
    expect(body.data.map((i) => i.id)).toEqual([newer.id])

    const page2 = (await (
      await authed("/inbox?status=pending&limit=1&page=2")
    ).json()) as { data: InboxItem[] }
    expect(page2.data.map((i) => i.id)).toEqual([older.id])

    const dismissed = (await (
      await authed("/inbox?status=dismissed")
    ).json()) as { total: number }
    expect(dismissed.total).toBe(1)
  })

  it("does not show another organization's rows", async () => {
    await seedTap()
    const other = await signupUser()
    const res = await honoApp.request("/inbox", {
      headers: { cookie: other.cookie },
    })
    expect(((await res.json()) as { total: number }).total).toBe(0)
  })
})

describe("POST /inbox/:id/accept", () => {
  it("creates an expense and links the row", async () => {
    const item = await seedTap()
    const res = await accept(item.id, { accountId: uahAccountId, categoryId })
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      item: InboxItem
      transaction: Transaction
    }

    expect(body.item.status).toBe("accepted")
    expect(body.item.accountId).toBe(uahAccountId)
    expect(body.item.transactionId).toBe(body.transaction.id)

    expect(body.transaction.type).toBe("expense")
    expect(body.transaction.amount).toBe(123.45)
    expect(body.transaction.accountId).toBe(uahAccountId)
    expect(body.transaction.categoryId).toBe(categoryId)
    expect(body.transaction.note).toBe("Silpo")
    expect(body.transaction.date).toBe("2026-10-13T07:15:00.000Z")
    expect(body.transaction.originalAmount).toBeNull()
    expect(body.transaction.madeBy?.id).toBe(user.userId)
  })

  it("falls back to the description, then null, for the note", async () => {
    const noMerchant = await seedTap({
      merchant: undefined,
      occurredAt: new Date("2026-10-13T08:00:00Z"),
    })
    const first = (await (
      await accept(noMerchant.id, { accountId: uahAccountId, categoryId })
    ).json()) as { transaction: Transaction }
    expect(first.transaction.note).toBe("SILPO KYIV")

    const bare = await seedTap({
      merchant: undefined,
      description: undefined,
      occurredAt: new Date("2026-10-13T08:30:00Z"),
    })
    const second = (await (
      await accept(bare.id, { accountId: uahAccountId, categoryId })
    ).json()) as { transaction: Transaction }
    expect(second.transaction.note).toBeNull()
  })

  it("converts into the account currency when they differ", async () => {
    const item = await seedTap({ currency: "UAH" })
    const res = await accept(item.id, { accountId: usdAccountId, categoryId })
    expect(res.status).toBe(200)
    const { transaction } = (await res.json()) as { transaction: Transaction }
    expect(transaction.originalAmount).toBe(123.45)
    expect(transaction.originalCurrency).toBe("UAH")
    expect(transaction.exchangeRate).toBeGreaterThan(0)
    expect(transaction.exchangeRate).not.toBe(1)
    expect(transaction.amount).toBe(
      Math.round(123.45 * transaction.exchangeRate! * 100) / 100
    )
  }, 15_000)

  it("uses the chosen account's currency when the row has none", async () => {
    const item = await seedTap({ card: "Wise Card", currency: undefined })
    expect(item.currency).toBeNull()
    const res = await accept(item.id, { accountId: usdAccountId, categoryId })
    expect(res.status).toBe(200)
    const { transaction } = (await res.json()) as { transaction: Transaction }
    expect(transaction.amount).toBe(123.45)
    expect(transaction.accountId).toBe(usdAccountId)
    expect(transaction.originalAmount).toBeNull()
    expect(transaction.originalCurrency).toBeNull()
    expect(transaction.exchangeRate).toBeNull()
  })

  it("returns 422 and keeps the row pending when no rate exists", async () => {
    const item = await seedTap({ currency: "XXX" })
    const res = await accept(item.id, { accountId: uahAccountId, categoryId })
    expect(res.status).toBe(422)
    const [row] = await db
      .select()
      .from(walletInbox)
      .where(eq(walletInbox.id, item.id))
    expect(row.status).toBe("pending")
    expect(row.transactionId).toBeNull()
  }, 15_000)

  it("saves the card label on an unlabelled account when asked", async () => {
    const item = await seedTap({ card: "Wise Card" })
    expect(item.accountId).toBeNull()
    const res = await accept(item.id, {
      accountId: usdAccountId,
      categoryId,
      saveCardLabel: true,
    })
    expect(res.status).toBe(200)
    const [row] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, usdAccountId))
    expect(row.cardLabel).toBe("Wise Card")
  }, 15_000)

  it("does not save the card label on a non-bank account", async () => {
    const loan = await createAccount({
      organizationId: user.organizationId,
      userId: user.userId,
      name: "Car loan",
      type: "loan",
      currency: "UAH",
    })
    const item = await seedTap({ card: "Wise Card" })
    const res = await accept(item.id, {
      accountId: loan.id,
      categoryId,
      saveCardLabel: true,
    })
    expect(res.status).toBe(200)
    const [row] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, loan.id))
    expect(row.cardLabel).toBeNull()
  }, 15_000)

  it("does not overwrite an existing card label", async () => {
    const item = await seedTap({ card: "Some Other Name" })
    await accept(item.id, {
      accountId: uahAccountId,
      categoryId,
      saveCardLabel: true,
    })
    const [row] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, uahAccountId))
    expect(row.cardLabel).toBe("Mono Black")
  })

  it("releases the row when the transaction cannot be created", async () => {
    const item = await seedTap()
    const res = await accept(item.id, {
      accountId: uahAccountId,
      categoryId: crypto.randomUUID(),
    })
    expect(res.status).toBeGreaterThanOrEqual(400)
    const [row] = await db
      .select()
      .from(walletInbox)
      .where(eq(walletInbox.id, item.id))
    expect(row.status).toBe("pending")
    expect(row.transactionId).toBeNull()
    const again = await accept(item.id, { accountId: uahAccountId, categoryId })
    expect(again.status).toBe(200)
  })

  it("returns 422 when the only known rate is exactly 1", async () => {
    await db.insert(exchangeRates).values({
      date: "2026-10-13",
      base: "UAH",
      target: "USD",
      rate: 1,
    })
    const item = await seedTap()
    const res = await accept(item.id, { accountId: usdAccountId, categoryId })
    expect(res.status).toBe(422)
    const [row] = await db
      .select()
      .from(walletInbox)
      .where(eq(walletInbox.id, item.id))
    expect(row.status).toBe("pending")
    expect(await db.select().from(transactions)).toHaveLength(0)
  })

  it("rejects a category from another organization", async () => {
    const other = await signupUser()
    const foreign = await createCategory({
      organizationId: other.organizationId,
      name: "Theirs",
      parentId: null,
      icon: "cart",
      type: "expense",
      color: "red",
    })
    const item = await seedTap()
    const res = await accept(item.id, {
      accountId: uahAccountId,
      categoryId: foreign.id,
    })
    expect(res.status).toBe(404)
    expect(((await res.json()) as { message: string }).message).toBe(
      "Category not found"
    )
    const [row] = await db
      .select()
      .from(walletInbox)
      .where(eq(walletInbox.id, item.id))
    expect(row.status).toBe("pending")
    expect(await db.select().from(transactions)).toHaveLength(0)
  })

  it("books nothing when a step after the transaction insert fails", async () => {
    const item = await seedTap()
    const real = transactionsService.createTransaction
    const spy = spyOn(
      transactionsService,
      "createTransaction"
    ).mockImplementation(async (...args) => {
      await real(...args)
      throw new Error("link step failed")
    })
    try {
      const res = await accept(item.id, {
        accountId: uahAccountId,
        categoryId,
      })
      expect(res.status).toBe(500)
    } finally {
      spy.mockRestore()
    }
    expect(await db.select().from(transactions)).toHaveLength(0)
    const [row] = await db
      .select()
      .from(walletInbox)
      .where(eq(walletInbox.id, item.id))
    expect(row.status).toBe("pending")
    expect(row.transactionId).toBeNull()

    const again = await accept(item.id, { accountId: uahAccountId, categoryId })
    expect(again.status).toBe(200)
    expect(await db.select().from(transactions)).toHaveLength(1)
  })

  it("rejects a row that is not pending", async () => {
    const item = await seedTap()
    await accept(item.id, { accountId: uahAccountId, categoryId })
    const again = await accept(item.id, { accountId: uahAccountId, categoryId })
    expect(again.status).toBe(409)
  })

  it("rejects unknown rows and accounts, and other organizations", async () => {
    const item = await seedTap()
    expect(
      (
        await accept(crypto.randomUUID(), {
          accountId: uahAccountId,
          categoryId,
        })
      ).status
    ).toBe(404)
    expect(
      (await accept(item.id, { accountId: crypto.randomUUID(), categoryId }))
        .status
    ).toBe(404)
    expect((await accept(item.id, { accountId: uahAccountId })).status).toBe(
      400
    )

    const other = await signupUser()
    const foreign = await honoApp.request(`/inbox/${item.id}/accept`, {
      method: "POST",
      headers: { cookie: other.cookie, "content-type": "application/json" },
      body: JSON.stringify({ accountId: uahAccountId, categoryId }),
    })
    expect(foreign.status).toBe(404)
  })
})

describe("POST /inbox/:id/dismiss", () => {
  it("marks a pending row dismissed and refuses a second time", async () => {
    const item = await seedTap()
    const res = await authed(`/inbox/${item.id}/dismiss`, { method: "POST" })
    expect(res.status).toBe(200)
    expect(((await res.json()) as InboxItem).status).toBe("dismissed")

    const again = await authed(`/inbox/${item.id}/dismiss`, { method: "POST" })
    expect(again.status).toBe(409)
  })

  it("returns 404 for an unknown row", async () => {
    const res = await authed(`/inbox/${crypto.randomUUID()}/dismiss`, {
      method: "POST",
    })
    expect(res.status).toBe(404)
  })
})

function undo(id: string, body: unknown = {}) {
  return authed(`/inbox/${id}/undo`, {
    method: "POST",
    body: JSON.stringify(body),
  })
}

describe("POST /inbox/:id/undo", () => {
  it("deletes the transaction and puts an accepted row back to pending", async () => {
    const item = await seedTap()
    const accepted = (await (
      await accept(item.id, { accountId: uahAccountId, categoryId })
    ).json()) as { transaction: Transaction }

    const res = await undo(item.id)
    expect(res.status).toBe(200)
    const body = (await res.json()) as InboxItem
    expect(body.status).toBe("pending")
    expect(body.transactionId).toBeNull()
    expect(body.accountId).toBe(uahAccountId)

    const left = await db
      .select()
      .from(transactions)
      .where(eq(transactions.id, accepted.transaction.id))
    expect(left).toHaveLength(0)

    const again = await accept(item.id, { accountId: uahAccountId, categoryId })
    expect(again.status).toBe(200)
  })

  it("restores the unmatched account of a tap from an unknown card", async () => {
    const item = await seedTap({ card: "Wise Card" })
    await accept(item.id, { accountId: usdAccountId, categoryId })

    const body = (await (await undo(item.id)).json()) as InboxItem
    expect(body.accountId).toBeNull()
  })

  it("forgets a card label the accept saved when asked", async () => {
    const item = await seedTap({ card: "Wise Card" })
    await accept(item.id, {
      accountId: usdAccountId,
      categoryId,
      saveCardLabel: true,
    })

    const body = (await (
      await undo(item.id, { forgetCardLabel: true })
    ).json()) as InboxItem
    expect(body.accountId).toBeNull()
    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, usdAccountId))
    expect(account.cardLabel).toBeNull()
  }, 15_000)

  it("keeps a card label that belongs to another card", async () => {
    const item = await seedTap({ card: "Wise Card" })
    await accept(item.id, { accountId: uahAccountId, categoryId })

    await undo(item.id, { forgetCardLabel: true })
    const [account] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, uahAccountId))
    expect(account.cardLabel).toBe("Mono Black")
  }, 15_000)

  it("still restores the row when its transaction was already deleted", async () => {
    const item = await seedTap()
    const accepted = (await (
      await accept(item.id, { accountId: uahAccountId, categoryId })
    ).json()) as { transaction: Transaction }
    await db
      .delete(transactions)
      .where(eq(transactions.id, accepted.transaction.id))

    const res = await undo(item.id)
    expect(res.status).toBe(200)
    expect(((await res.json()) as InboxItem).status).toBe("pending")
  })

  it("puts a dismissed row back to pending", async () => {
    const item = await seedTap()
    await authed(`/inbox/${item.id}/dismiss`, { method: "POST" })

    const res = await undo(item.id)
    expect(res.status).toBe(200)
    expect(((await res.json()) as InboxItem).status).toBe("pending")
  })

  it("rejects a pending row, unknown rows and other organizations", async () => {
    const item = await seedTap()
    expect((await undo(item.id)).status).toBe(409)
    expect((await undo(crypto.randomUUID())).status).toBe(404)

    await authed(`/inbox/${item.id}/dismiss`, { method: "POST" })
    const other = await signupUser()
    const foreign = await honoApp.request(`/inbox/${item.id}/undo`, {
      method: "POST",
      headers: { cookie: other.cookie, "content-type": "application/json" },
      body: JSON.stringify({}),
    })
    expect(foreign.status).toBe(404)
  })
})
