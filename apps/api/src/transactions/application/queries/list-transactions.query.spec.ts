import { faker } from "@faker-js/faker"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { Transaction } from "../../domain/entities/transaction.entity"
import { TransactionRepository } from "../../domain/repositories/transaction.repository"
import {
  ListTransactionsQuery,
  ListTransactionsHandler,
} from "./list-transactions.query"

describe("ListTransactionsHandler", () => {
  let handler: ListTransactionsHandler
  let transactionRepo: TransactionRepository
  const userId = faker.string.uuid()

  beforeEach(() => {
    transactionRepo = {
      save: vi.fn(),
      saveTransferPair: vi.fn(),
      findById: vi.fn(),
      findByTransferId: vi.fn(),
      findAll: vi.fn().mockResolvedValue({ data: [], total: 0 }),
      delete: vi.fn(),
      deleteByTransferId: vi.fn(),
    } as unknown as TransactionRepository

    handler = new ListTransactionsHandler(transactionRepo)
  })

  it("returns paginated transactions", async () => {
    const transactions = [
      Transaction.fromPersistence({
        id: faker.string.uuid(),
        userId,
        accountId: faker.string.uuid(),
        type: "expense",
        amount: 50,
        categoryId: faker.string.uuid(),
        note: null,
        date: new Date(),
        myShare: null,
        settled: true,
        originalAmount: null,
        originalCurrency: null,
        exchangeRate: null,
        transferId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ]
    vi.mocked(transactionRepo.findAll).mockResolvedValue({
      data: transactions,
      total: 1,
    })

    const result = await handler.execute(
      new ListTransactionsQuery(userId, { page: 1, limit: 50 })
    )
    expect(result.data).toHaveLength(1)
    expect(result.total).toBe(1)
    expect(transactionRepo.findAll).toHaveBeenCalledWith({
      userId,
      page: 1,
      limit: 50,
    })
  })

  it("passes filters to repository", async () => {
    const query = new ListTransactionsQuery(userId, {
      page: 1,
      limit: 20,
      type: "expense",
      settled: false,
    })
    await handler.execute(query)
    expect(transactionRepo.findAll).toHaveBeenCalledWith({
      userId,
      page: 1,
      limit: 20,
      type: "expense",
      settled: false,
    })
  })
})
