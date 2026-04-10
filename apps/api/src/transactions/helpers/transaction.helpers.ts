import { BadRequestException } from "@nestjs/common"
import { type Transaction } from "@workspace/api-contract"
import { type TransactionRow } from "../transaction.repository"

export function toResponse(row: TransactionRow): Transaction {
  return {
    id: row.id,
    accountId: row.accountId,
    type: row.amount < 0 ? "expense" : "income",
    amount: Math.abs(row.amount),
    categoryId: row.categoryId ?? null,
    note: row.note ?? null,
    date: row.date.toISOString(),
    myShare: row.myShare ?? null,
    settled: row.settled,
    originalAmount: row.originalAmount ?? null,
    originalCurrency: row.originalCurrency ?? null,
    exchangeRate: row.exchangeRate ?? null,
    transferId: row.transferId ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function validateExchangeRate(
  originalAmount?: number | null,
  originalCurrency?: string | null,
  exchangeRate?: number | null
): void {
  const fields = [originalAmount, originalCurrency, exchangeRate]
  const provided = fields.filter((f) => f != null).length
  if (provided !== 0 && provided !== 3) {
    throw new BadRequestException(
      "Exchange rate fields must all be provided or all omitted"
    )
  }
}
