import { Inject, Injectable } from "@nestjs/common"
import { and, count, desc, eq, gte, inArray, lte } from "drizzle-orm"
import { type DbClient, transactions } from "@workspace/db"
import { DB_CLIENT } from "@/database/database.module"

export type TransactionRow = typeof transactions.$inferSelect

export interface ListTransactionsFilters {
  userId: string
  accountId?: string
  type?: string
  categoryId?: string
  settled?: boolean
  dateFrom?: Date
  dateTo?: Date
  page: number
  limit: number
}

@Injectable()
export class TransactionRepository {
  constructor(@Inject(DB_CLIENT) private readonly db: DbClient) {}

  async insert(data: {
    userId: string
    accountId: string
    type: string
    amount: number
    categoryId: string | null
    note: string | null
    date: Date
    myShare: number | null
    settled: boolean
    originalAmount: number | null
    originalCurrency: string | null
    exchangeRate: number | null
    transferId: string | null
  }): Promise<TransactionRow> {
    const [row] = await this.db
      .insert(transactions)
      .values(data)
      .returning()
    return row
  }

  async update(
    id: string,
    data: {
      accountId?: string
      type?: string
      amount?: number
      categoryId?: string | null
      note?: string | null
      date?: Date
      myShare?: number | null
      settled?: boolean
      originalAmount?: number | null
      originalCurrency?: string | null
      exchangeRate?: number | null
      transferId?: string | null
    }
  ): Promise<TransactionRow> {
    const [row] = await this.db
      .update(transactions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(transactions.id, id))
      .returning()
    return row
  }

  async insertTransferPair(
    outgoing: Parameters<TransactionRepository["insert"]>[0],
    incoming: Parameters<TransactionRepository["insert"]>[0]
  ): Promise<[TransactionRow, TransactionRow]> {
    return this.db.transaction(async (tx) => {
      const [outRow] = await tx
        .insert(transactions)
        .values(outgoing)
        .returning()
      const [inRow] = await tx
        .insert(transactions)
        .values(incoming)
        .returning()
      return [outRow, inRow]
    })
  }

  async updateTransferPair(
    outgoingId: string,
    outgoingData: Parameters<TransactionRepository["update"]>[1],
    incomingId: string,
    incomingData: Parameters<TransactionRepository["update"]>[1]
  ): Promise<[TransactionRow, TransactionRow]> {
    return this.db.transaction(async (tx) => {
      const [outRow] = await tx
        .update(transactions)
        .set({ ...outgoingData, updatedAt: new Date() })
        .where(eq(transactions.id, outgoingId))
        .returning()
      const [inRow] = await tx
        .update(transactions)
        .set({ ...incomingData, updatedAt: new Date() })
        .where(eq(transactions.id, incomingId))
        .returning()
      return [outRow, inRow]
    })
  }

  async findById(id: string, userId: string): Promise<TransactionRow | null> {
    const rows = await this.db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
      .limit(1)
    return rows[0] ?? null
  }

  async findByTransferId(
    transferId: string,
    userId: string
  ): Promise<TransactionRow[]> {
    return this.db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.transferId, transferId),
          eq(transactions.userId, userId)
        )
      )
  }

  async findAll(
    filters: ListTransactionsFilters
  ): Promise<{ data: TransactionRow[]; total: number }> {
    const conditions = [eq(transactions.userId, filters.userId)]

    if (filters.accountId)
      conditions.push(eq(transactions.accountId, filters.accountId))
    if (filters.type) conditions.push(eq(transactions.type, filters.type))
    if (filters.categoryId)
      conditions.push(eq(transactions.categoryId, filters.categoryId))
    if (filters.settled !== undefined)
      conditions.push(eq(transactions.settled, filters.settled))
    if (filters.dateFrom)
      conditions.push(gte(transactions.date, filters.dateFrom))
    if (filters.dateTo)
      conditions.push(lte(transactions.date, filters.dateTo))

    const where = and(...conditions)

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(transactions)
      .where(where)

    const offset = (filters.page - 1) * filters.limit
    const rows = await this.db
      .select()
      .from(transactions)
      .where(where)
      .orderBy(desc(transactions.date))
      .limit(filters.limit)
      .offset(offset)

    const resultIds = new Set(rows.map((r) => r.id))
    const missingTransferIds = rows
      .filter(
        (r) =>
          r.transferId &&
          !rows.some(
            (other) => other.transferId === r.transferId && other.id !== r.id
          )
      )
      .map((r) => r.transferId!)

    let pairedRows: typeof rows = []
    if (missingTransferIds.length > 0) {
      pairedRows = await this.db
        .select()
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, filters.userId),
            inArray(transactions.transferId, missingTransferIds)
          )
        )
      pairedRows = pairedRows.filter((r) => !resultIds.has(r.id))
    }

    return { data: [...rows, ...pairedRows], total }
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.db
      .delete(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
  }

  async countByAccountId(accountId: string): Promise<number> {
    const [{ total }] = await this.db
      .select({ total: count() })
      .from(transactions)
      .where(eq(transactions.accountId, accountId))
    return total
  }

  async deleteByTransferId(transferId: string, userId: string): Promise<void> {
    await this.db
      .delete(transactions)
      .where(
        and(
          eq(transactions.transferId, transferId),
          eq(transactions.userId, userId)
        )
      )
  }
}
