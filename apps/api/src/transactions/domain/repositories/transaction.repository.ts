import { Transaction } from "../entities/transaction.entity"

export interface ListTransactionsFilters {
  userId: string
  accountId?: string
  type?: string
  categoryId?: string
  settled?: boolean
  orphaned?: boolean
  dateFrom?: Date
  dateTo?: Date
  page: number
  limit: number
}

export abstract class TransactionRepository {
  abstract save(transaction: Transaction): Promise<Transaction>
  abstract saveTransferPair(
    outgoing: Transaction,
    incoming: Transaction
  ): Promise<[Transaction, Transaction]>
  abstract findById(id: string, userId: string): Promise<Transaction | null>
  abstract findByTransferId(transferId: string): Promise<Transaction[]>
  abstract findAll(
    filters: ListTransactionsFilters
  ): Promise<{ data: Transaction[]; total: number }>
  abstract countByAccountId(accountId: string): Promise<number>
  abstract delete(id: string, userId: string): Promise<void>
  abstract deleteByTransferId(transferId: string): Promise<void>
}
