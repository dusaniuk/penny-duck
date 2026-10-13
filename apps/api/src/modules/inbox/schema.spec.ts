import { beforeEach, describe, expect, it } from "bun:test"
import { eq } from "drizzle-orm"
import { accounts, transactions, walletInbox } from "@workspace/db"
import { db } from "@/db"
import { createAccount } from "@/modules/accounts/service"
import { createCategory } from "@/modules/categories/service"
import { createTransaction } from "@/modules/transactions/service"
import { signupUser, truncateAll } from "@/test/setup"

async function seed() {
  const user = await signupUser()
  const account = await createAccount({
    organizationId: user.organizationId,
    userId: user.userId,
    name: "Bank",
    type: "bank",
    currency: "UAH",
  })
  const category = await createCategory({
    organizationId: user.organizationId,
    name: "Groceries",
    parentId: null,
    icon: "cart",
    type: "expense",
    color: "red",
  })
  const transaction = await createTransaction({
    organizationId: user.organizationId,
    accountId: account.id,
    type: "expense",
    amount: 10,
    categoryId: category.id,
    date: new Date(),
    madeById: user.userId,
  })
  return { user, account, transaction }
}

function inboxRow(
  user: { organizationId: string; userId: string },
  overrides: Partial<typeof walletInbox.$inferInsert> = {}
) {
  return {
    organizationId: user.organizationId,
    userId: user.userId,
    card: "Mono Black",
    amount: 12.5,
    currency: "UAH",
    occurredAt: new Date("2026-10-13T10:00:00Z"),
    ...overrides,
  }
}

describe("wallet_inbox schema", () => {
  beforeEach(async () => {
    await truncateAll()
  })

  it("nulls transaction_id when the transaction is deleted", async () => {
    const { user, account, transaction } = await seed()
    await db.insert(walletInbox).values(
      inboxRow(user, {
        accountId: account.id,
        transactionId: transaction.id,
        status: "accepted",
      })
    )

    await db.delete(transactions).where(eq(transactions.id, transaction.id))

    const [row] = await db.select().from(walletInbox)
    expect(row.transactionId).toBeNull()
    expect(row.status).toBe("accepted")
  })

  it("nulls account_id when the account is deleted", async () => {
    const { user, account, transaction } = await seed()
    await db.delete(transactions).where(eq(transactions.id, transaction.id))
    await db
      .insert(walletInbox)
      .values(inboxRow(user, { accountId: account.id }))

    await db.delete(accounts).where(eq(accounts.id, account.id))

    const [row] = await db.select().from(walletInbox)
    expect(row.accountId).toBeNull()
  })

  it("rejects a duplicate tap for the same org, card, amount, currency and time", async () => {
    const { user } = await seed()
    await db.insert(walletInbox).values(inboxRow(user))

    await expect(
      (async () => {
        await db.insert(walletInbox).values(inboxRow(user))
      })()
    ).rejects.toThrow()
  })

  it("stores a card label on accounts", async () => {
    const { account } = await seed()
    await db
      .update(accounts)
      .set({ cardLabel: "Mono Black" })
      .where(eq(accounts.id, account.id))
    const [row] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, account.id))
    expect(row.cardLabel).toBe("Mono Black")
  })
})
