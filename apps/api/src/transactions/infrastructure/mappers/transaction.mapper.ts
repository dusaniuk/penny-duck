import { Transaction } from "../../domain/entities/transaction.entity"

interface TransactionRow {
  id: string
  userId: string
  accountId: string | null
  type: string
  amount: string
  categoryId: string | null
  note: string | null
  date: Date
  myShare: string | null
  settled: boolean
  originalAmount: string | null
  originalCurrency: string | null
  exchangeRate: string | null
  transferId: string | null
  createdAt: Date
  updatedAt: Date
}

export class TransactionMapper {
  static toDomain(row: TransactionRow): Transaction {
    return Transaction.fromPersistence({
      id: row.id,
      userId: row.userId,
      accountId: row.accountId,
      type: row.type,
      amount: Number(row.amount),
      categoryId: row.categoryId,
      note: row.note,
      date: row.date,
      myShare: row.myShare != null ? Number(row.myShare) : null,
      settled: row.settled,
      originalAmount:
        row.originalAmount != null ? Number(row.originalAmount) : null,
      originalCurrency: row.originalCurrency,
      exchangeRate:
        row.exchangeRate != null ? Number(row.exchangeRate) : null,
      transferId: row.transferId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    })
  }
}
