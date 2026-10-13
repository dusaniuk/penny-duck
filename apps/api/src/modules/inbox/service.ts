import { and, asc, count, desc, eq, sql } from "drizzle-orm"
import { HTTPException } from "hono/http-exception"
import { accounts, categories, walletInbox } from "@workspace/db"
import type { InboxItem, Transaction } from "@workspace/api-contract"
import { db } from "@/db"
import { getRate } from "@/modules/exchange-rates/service"
import { createTransaction } from "@/modules/transactions/service"

export type InboxRow = typeof walletInbox.$inferSelect

export function toResponse(row: InboxRow): InboxItem {
  return {
    id: row.id,
    status: row.status,
    card: row.card,
    merchant: row.merchant,
    description: row.description,
    amount: row.amount,
    currency: row.currency,
    occurredAt: row.occurredAt.toISOString(),
    accountId: row.accountId,
    transactionId: row.transactionId,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function matchAccountByCardLabel(
  organizationId: string,
  card: string
): Promise<string | null> {
  const rows = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(
        eq(accounts.organizationId, organizationId),
        sql`lower(trim(${accounts.cardLabel})) = lower(trim(${card}))`
      )
    )
    .orderBy(asc(accounts.createdAt))
    .limit(1)
  return rows[0]?.id ?? null
}

export interface IngestWalletTapInput {
  organizationId: string
  userId: string
  card: string
  amount: number
  currency: string
  merchant?: string
  description?: string
  occurredAt?: Date
}

export async function ingestWalletTap(
  input: IngestWalletTapInput
): Promise<{ item: InboxItem; created: boolean }> {
  const occurredAt = input.occurredAt ?? new Date()
  const accountId = await matchAccountByCardLabel(
    input.organizationId,
    input.card
  )

  const inserted = await db
    .insert(walletInbox)
    .values({
      organizationId: input.organizationId,
      userId: input.userId,
      accountId,
      card: input.card,
      merchant: input.merchant ?? null,
      description: input.description ?? null,
      amount: input.amount,
      currency: input.currency,
      occurredAt,
    })
    .onConflictDoNothing({
      target: [
        walletInbox.organizationId,
        walletInbox.card,
        walletInbox.amount,
        walletInbox.currency,
        walletInbox.occurredAt,
      ],
    })
    .returning()

  if (inserted[0]) return { item: toResponse(inserted[0]), created: true }

  const [existing] = await db
    .select()
    .from(walletInbox)
    .where(
      and(
        eq(walletInbox.organizationId, input.organizationId),
        eq(walletInbox.card, input.card),
        eq(walletInbox.amount, input.amount),
        eq(walletInbox.currency, input.currency),
        eq(walletInbox.occurredAt, occurredAt)
      )
    )
    .limit(1)
  return { item: toResponse(existing), created: false }
}

export interface ListInboxFilters {
  organizationId: string
  status?: string
  page: number
  limit: number
}

export async function listInboxItems(
  filters: ListInboxFilters
): Promise<{ data: InboxItem[]; total: number; page: number; limit: number }> {
  const conditions = [eq(walletInbox.organizationId, filters.organizationId)]
  if (filters.status) conditions.push(eq(walletInbox.status, filters.status))
  const where = and(...conditions)

  const [{ total }] = await db
    .select({ total: count() })
    .from(walletInbox)
    .where(where)

  const rows = await db
    .select()
    .from(walletInbox)
    .where(where)
    .orderBy(desc(walletInbox.occurredAt), desc(walletInbox.createdAt))
    .limit(filters.limit)
    .offset((filters.page - 1) * filters.limit)

  return {
    data: rows.map(toResponse),
    total,
    page: filters.page,
    limit: filters.limit,
  }
}

async function findPendingRow(
  id: string,
  organizationId: string
): Promise<InboxRow> {
  const [row] = await db
    .select()
    .from(walletInbox)
    .where(
      and(
        eq(walletInbox.id, id),
        eq(walletInbox.organizationId, organizationId)
      )
    )
    .limit(1)
  if (!row) throw new HTTPException(404, { message: "Inbox item not found" })
  if (row.status !== "pending") {
    throw new HTTPException(409, { message: "Inbox item is not pending" })
  }
  return row
}

export interface AcceptInboxItemInput {
  id: string
  organizationId: string
  userId: string
  accountId: string
  categoryId: string
  saveCardLabel?: boolean
}

export async function acceptInboxItem(
  input: AcceptInboxItemInput
): Promise<{ item: InboxItem; transaction: Transaction }> {
  const row = await findPendingRow(input.id, input.organizationId)

  const [account] = await db
    .select({
      id: accounts.id,
      type: accounts.type,
      currency: accounts.currency,
      cardLabel: accounts.cardLabel,
    })
    .from(accounts)
    .where(
      and(
        eq(accounts.id, input.accountId),
        eq(accounts.organizationId, input.organizationId)
      )
    )
    .limit(1)
  if (!account) throw new HTTPException(404, { message: "Account not found" })

  const [category] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.id, input.categoryId),
        eq(categories.organizationId, input.organizationId)
      )
    )
    .limit(1)
  if (!category) {
    throw new HTTPException(404, { message: "Category not found" })
  }

  let amount = row.amount
  let fx: {
    originalAmount: number
    originalCurrency: string
    exchangeRate: number
  } | null = null

  if (row.currency !== account.currency) {
    const rate = await lookupRate(
      row.currency,
      account.currency,
      row.occurredAt
    )
    amount = Math.round(row.amount * rate * 100) / 100
    fx = {
      originalAmount: row.amount,
      originalCurrency: row.currency,
      exchangeRate: rate,
    }
  }

  return db.transaction(async (tx) => {
    const [claimed] = await tx
      .update(walletInbox)
      .set({ status: "accepted", accountId: account.id, updatedAt: new Date() })
      .where(and(eq(walletInbox.id, row.id), eq(walletInbox.status, "pending")))
      .returning()
    if (!claimed) {
      throw new HTTPException(409, { message: "Inbox item is not pending" })
    }

    const transaction = await createTransaction(
      {
        organizationId: input.organizationId,
        accountId: account.id,
        type: "expense",
        amount,
        categoryId: input.categoryId,
        date: row.occurredAt,
        note: row.merchant ?? row.description ?? null,
        madeById: input.userId,
        ...fx,
      },
      tx
    )

    const [updated] = await tx
      .update(walletInbox)
      .set({ transactionId: transaction.id, updatedAt: new Date() })
      .where(eq(walletInbox.id, row.id))
      .returning()

    if (
      input.saveCardLabel &&
      account.type === "bank" &&
      account.cardLabel === null
    ) {
      await tx
        .update(accounts)
        .set({ cardLabel: row.card, updatedAt: new Date() })
        .where(eq(accounts.id, account.id))
    }

    return { item: toResponse(updated), transaction }
  })
}

// getRate answers 1 when the pair is unknown instead of throwing; two
// different currencies never trade at exactly 1, so treat that as missing.
async function lookupRate(
  base: string,
  target: string,
  date: Date
): Promise<number> {
  let rate: number
  try {
    rate = await getRate(base, target, date)
  } catch {
    throw new HTTPException(422, {
      message: `Exchange rate unavailable for ${base} to ${target}`,
    })
  }
  if (rate === 1) {
    throw new HTTPException(422, {
      message: `Exchange rate unavailable for ${base} to ${target}`,
    })
  }
  return rate
}

export async function dismissInboxItem(
  id: string,
  organizationId: string
): Promise<InboxItem> {
  const row = await findPendingRow(id, organizationId)
  const [updated] = await db
    .update(walletInbox)
    .set({ status: "dismissed", updatedAt: new Date() })
    .where(and(eq(walletInbox.id, row.id), eq(walletInbox.status, "pending")))
    .returning()
  if (!updated) {
    throw new HTTPException(409, { message: "Inbox item is not pending" })
  }
  return toResponse(updated)
}
