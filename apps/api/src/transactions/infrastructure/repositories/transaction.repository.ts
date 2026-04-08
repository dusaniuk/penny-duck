import { Inject, Injectable } from "@nestjs/common"
import { and, count, desc, eq, gte, isNull, lte } from "drizzle-orm"
import { type DbClient, transactions } from "@workspace/db"
import { DB_CLIENT } from "@/database/database.module"
import { Transaction } from "../../domain/entities/transaction.entity"
import {
  ListTransactionsFilters,
  TransactionRepository,
} from "../../domain/repositories/transaction.repository"
import { TransactionMapper } from "../mappers/transaction.mapper"

@Injectable()
export class TransactionRepositoryImpl extends TransactionRepository {
  constructor(@Inject(DB_CLIENT) private readonly db: DbClient) {
    super()
  }

  async save(transaction: Transaction): Promise<Transaction> {
    if (transaction.id === "") {
      const rows = await this.db
        .insert(transactions)
        .values(this.toRow(transaction))
        .returning()
      return TransactionMapper.toDomain(rows[0])
    }
    const rows = await this.db
      .update(transactions)
      .set({
        amount: transaction.amount.toString(),
        categoryId: transaction.categoryId,
        note: transaction.note,
        date: transaction.date,
        myShare: transaction.myShare?.toString() ?? null,
        settled: transaction.settled,
        originalAmount:
          transaction.exchangeRate?.originalAmount.toString() ?? null,
        originalCurrency: transaction.exchangeRate?.originalCurrency ?? null,
        exchangeRate: transaction.exchangeRate?.rate.toString() ?? null,
        updatedAt: new Date(),
      })
      .where(eq(transactions.id, transaction.id))
      .returning()
    return TransactionMapper.toDomain(rows[0])
  }

  async saveTransferPair(
    outgoing: Transaction,
    incoming: Transaction
  ): Promise<[Transaction, Transaction]> {
    const isUpdate = outgoing.id !== "" && incoming.id !== ""

    const result = await this.db.transaction(async (tx) => {
      if (isUpdate) {
        const [outRow] = await tx
          .update(transactions)
          .set({
            amount: outgoing.amount.toString(),
            note: outgoing.note,
            date: outgoing.date,
            originalAmount:
              outgoing.exchangeRate?.originalAmount.toString() ?? null,
            originalCurrency:
              outgoing.exchangeRate?.originalCurrency ?? null,
            exchangeRate: outgoing.exchangeRate?.rate.toString() ?? null,
            updatedAt: new Date(),
          })
          .where(eq(transactions.id, outgoing.id))
          .returning()
        const [inRow] = await tx
          .update(transactions)
          .set({
            amount: incoming.amount.toString(),
            note: incoming.note,
            date: incoming.date,
            updatedAt: new Date(),
          })
          .where(eq(transactions.id, incoming.id))
          .returning()
        return [outRow, inRow] as const
      }

      const [outRow] = await tx
        .insert(transactions)
        .values(this.toRow(outgoing))
        .returning()
      const [inRow] = await tx
        .insert(transactions)
        .values(this.toRow(incoming))
        .returning()
      return [outRow, inRow] as const
    })

    return [
      TransactionMapper.toDomain(result[0]),
      TransactionMapper.toDomain(result[1]),
    ]
  }

  async findById(id: string, userId: string): Promise<Transaction | null> {
    const rows = await this.db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
      .limit(1)
    if (rows.length === 0) return null
    return TransactionMapper.toDomain(rows[0])
  }

  async findByTransferId(transferId: string): Promise<Transaction[]> {
    const rows = await this.db
      .select()
      .from(transactions)
      .where(eq(transactions.transferId, transferId))
    return rows.map(TransactionMapper.toDomain)
  }

  async findAll(
    filters: ListTransactionsFilters
  ): Promise<{ data: Transaction[]; total: number }> {
    const conditions = [eq(transactions.userId, filters.userId)]

    if (filters.accountId)
      conditions.push(eq(transactions.accountId, filters.accountId))
    if (filters.type) conditions.push(eq(transactions.type, filters.type))
    if (filters.categoryId)
      conditions.push(eq(transactions.categoryId, filters.categoryId))
    if (filters.settled !== undefined)
      conditions.push(eq(transactions.settled, filters.settled))
    if (filters.orphaned === true)
      conditions.push(isNull(transactions.accountId))
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

    return { data: rows.map(TransactionMapper.toDomain), total }
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

  async deleteByTransferId(transferId: string): Promise<void> {
    await this.db
      .delete(transactions)
      .where(eq(transactions.transferId, transferId))
  }

  private toRow(t: Transaction) {
    return {
      userId: t.userId,
      accountId: t.accountId,
      type: t.type,
      amount: t.amount.toString(),
      categoryId: t.categoryId,
      note: t.note,
      date: t.date,
      myShare: t.myShare?.toString() ?? null,
      settled: t.settled,
      originalAmount: t.exchangeRate?.originalAmount.toString() ?? null,
      originalCurrency: t.exchangeRate?.originalCurrency ?? null,
      exchangeRate: t.exchangeRate?.rate.toString() ?? null,
      transferId: t.transferId,
    }
  }
}
