import { BadRequestException } from "@nestjs/common"
import { type Transaction } from "@workspace/api-contract"
import { type TransactionRow, type TransactionRowWithUser } from "../transaction.repository"

export function toResponse(
  row: TransactionRow | TransactionRowWithUser,
  homeAmount?: number
): Transaction {
  const amount = Math.abs(row.amount)
  const madeByName = "madeByName" in row ? row.madeByName : null
  return {
    id: row.id,
    accountId: row.accountId,
    type: row.amount < 0 ? "expense" : "income",
    amount,
    homeAmount: homeAmount ?? amount,
    categoryId: row.categoryId ?? null,
    note: row.note ?? null,
    date: row.date.toISOString(),
    settled: row.settled,
    originalAmount: row.originalAmount ?? null,
    originalCurrency: row.originalCurrency ?? null,
    exchangeRate: row.exchangeRate ?? null,
    transferId: row.transferId ?? null,
    reimbursementId: row.reimbursementId ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    madeBy: row.madeById
      ? { id: row.madeById, name: madeByName ?? "Unknown" }
      : null,
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
