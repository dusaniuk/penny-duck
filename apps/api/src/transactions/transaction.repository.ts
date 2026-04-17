import { Inject, Injectable } from "@nestjs/common"
import { and, count, desc, eq, gt, gte, inArray, isNotNull, isNull, lt, lte, or } from "drizzle-orm"
import { type DbClient, organizationMembers, transactions, users } from "@workspace/db"
import { DB_CLIENT } from "@/database/database.module"

export type TransactionRow = typeof transactions.$inferSelect

export interface TransactionRowWithUser extends TransactionRow {
  madeByName: string | null
}

export interface ListTransactionsFilters {
  organizationId: string
  accountId?: string
  type?: string
  categoryId?: string
  settled?: boolean
  transfer?: boolean
  dateFrom?: Date
  dateTo?: Date
  madeById?: string
  page: number
  limit: number
}

@Injectable()
export class TransactionRepository {
  constructor(@Inject(DB_CLIENT) private readonly db: DbClient) {}

  async insert(data: {
    organizationId: string
    accountId: string
    amount: number
    categoryId: string | null
    note: string | null
    date: Date
    settled: boolean
    originalAmount: number | null
    originalCurrency: string | null
    exchangeRate: number | null
    transferId: string | null
    reimbursementId: string | null
    madeById: string | null
  }): Promise<TransactionRow> {
    const [row] = await this.db
      .insert(transactions)
      .values(data)
      .returning()
    return row
  }

  async update(
    id: string,
    organizationId: string,
    data: {
      accountId?: string
      amount?: number
      categoryId?: string | null
      note?: string | null
      date?: Date
      settled?: boolean
      originalAmount?: number | null
      originalCurrency?: string | null
      exchangeRate?: number | null
      transferId?: string | null
      reimbursementId?: string | null
      madeById?: string | null
    }
  ): Promise<TransactionRow> {
    const [row] = await this.db
      .update(transactions)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(transactions.id, id), eq(transactions.organizationId, organizationId)))
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
    outgoingData: Parameters<TransactionRepository["update"]>[2],
    incomingId: string,
    incomingData: Parameters<TransactionRepository["update"]>[2],
    organizationId: string
  ): Promise<[TransactionRow, TransactionRow]> {
    return this.db.transaction(async (tx) => {
      const [outRow] = await tx
        .update(transactions)
        .set({ ...outgoingData, updatedAt: new Date() })
        .where(and(eq(transactions.id, outgoingId), eq(transactions.organizationId, organizationId)))
        .returning()
      const [inRow] = await tx
        .update(transactions)
        .set({ ...incomingData, updatedAt: new Date() })
        .where(and(eq(transactions.id, incomingId), eq(transactions.organizationId, organizationId)))
        .returning()
      return [outRow, inRow]
    })
  }

  async findById(id: string, organizationId: string): Promise<TransactionRow | null> {
    const rows = await this.db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.organizationId, organizationId)))
      .limit(1)
    return rows[0] ?? null
  }

  async findByIdWithUser(
    id: string,
    organizationId: string
  ): Promise<TransactionRowWithUser | null> {
    const rows = await this.db
      .select(this.selectWithUser)
      .from(transactions)
      .leftJoin(users, eq(transactions.madeById, users.id))
      .where(
        and(eq(transactions.id, id), eq(transactions.organizationId, organizationId))
      )
      .limit(1)
    return rows[0] ?? null
  }

  async findByTransferId(
    transferId: string,
    organizationId: string
  ): Promise<TransactionRow[]> {
    return this.db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.transferId, transferId),
          eq(transactions.organizationId, organizationId)
        )
      )
  }

  async findByReimbursementId(
    reimbursementId: string,
    organizationId: string
  ): Promise<TransactionRow[]> {
    return this.db
      .select()
      .from(transactions)
      .where(
        and(
          eq(transactions.reimbursementId, reimbursementId),
          eq(transactions.organizationId, organizationId)
        )
      )
  }

  private get selectWithUser() {
    return {
      id: transactions.id,
      organizationId: transactions.organizationId,
      accountId: transactions.accountId,
      amount: transactions.amount,
      categoryId: transactions.categoryId,
      note: transactions.note,
      date: transactions.date,
      settled: transactions.settled,
      reimbursementId: transactions.reimbursementId,
      originalAmount: transactions.originalAmount,
      originalCurrency: transactions.originalCurrency,
      exchangeRate: transactions.exchangeRate,
      transferId: transactions.transferId,
      madeById: transactions.madeById,
      createdAt: transactions.createdAt,
      updatedAt: transactions.updatedAt,
      madeByName: users.name,
    } as const
  }

  async findAll(
    filters: ListTransactionsFilters
  ): Promise<{ data: TransactionRowWithUser[]; total: number }> {
    const conditions = [eq(transactions.organizationId, filters.organizationId)]

    if (filters.accountId)
      conditions.push(eq(transactions.accountId, filters.accountId))
    if (filters.type === "expense")
      conditions.push(lt(transactions.amount, 0))
    if (filters.type === "income")
      conditions.push(gt(transactions.amount, 0))
    if (filters.categoryId)
      conditions.push(eq(transactions.categoryId, filters.categoryId))
    if (filters.settled !== undefined)
      conditions.push(eq(transactions.settled, filters.settled))
    if (filters.accountId) {
      // Reimbursement transfers come as a sign-opposite pair: a negative
      // bookkeeping entry on the original expense account and a positive
      // entry on the receiving account. Only the receiving (positive) side
      // should ever appear in an account view.
      conditions.push(
        or(isNull(transactions.reimbursementId), gt(transactions.amount, 0))!
      )
    } else {
      conditions.push(isNull(transactions.reimbursementId))
    }
    if (filters.transfer === true)
      conditions.push(isNotNull(transactions.transferId))
    if (filters.transfer === false)
      conditions.push(isNull(transactions.transferId))
    if (filters.dateFrom)
      conditions.push(gte(transactions.date, filters.dateFrom))
    if (filters.dateTo)
      conditions.push(lte(transactions.date, filters.dateTo))
    if (filters.madeById)
      conditions.push(eq(transactions.madeById, filters.madeById))

    const where = and(...conditions)

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(transactions)
      .where(where)

    const offset = (filters.page - 1) * filters.limit
    const rows = await this.db
      .select(this.selectWithUser)
      .from(transactions)
      .leftJoin(users, eq(transactions.madeById, users.id))
      .where(where)
      .orderBy(desc(transactions.date), desc(transactions.createdAt))
      .limit(filters.limit)
      .offset(offset)

    const resultIds = new Set(rows.map((r) => r.id))
    const missingTransferIds = rows
      .filter(
        (r) =>
          r.transferId &&
          !r.reimbursementId &&
          !rows.some(
            (other) => other.transferId === r.transferId && other.id !== r.id
          )
      )
      .map((r) => r.transferId!)

    let pairedRows: typeof rows = []
    if (missingTransferIds.length > 0) {
      pairedRows = await this.db
        .select(this.selectWithUser)
        .from(transactions)
        .leftJoin(users, eq(transactions.madeById, users.id))
        .where(
          and(
            eq(transactions.organizationId, filters.organizationId),
            inArray(transactions.transferId, missingTransferIds)
          )
        )
      pairedRows = pairedRows.filter((r) => !resultIds.has(r.id))
    }

    return { data: [...rows, ...pairedRows], total }
  }

  async delete(id: string, organizationId: string): Promise<void> {
    await this.db
      .delete(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.organizationId, organizationId)))
  }

  async isMemberOfOrg(userId: string, organizationId: string): Promise<boolean> {
    const rows = await this.db
      .select({ id: organizationMembers.id })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, userId),
          eq(organizationMembers.organizationId, organizationId)
        )
      )
      .limit(1)
    return rows.length > 0
  }

  async countByAccountId(accountId: string): Promise<number> {
    const [{ total }] = await this.db
      .select({ total: count() })
      .from(transactions)
      .where(eq(transactions.accountId, accountId))
    return total
  }

  async deleteByTransferId(transferId: string, organizationId: string): Promise<void> {
    await this.db
      .delete(transactions)
      .where(
        and(
          eq(transactions.transferId, transferId),
          eq(transactions.organizationId, organizationId)
        )
      )
  }
}
