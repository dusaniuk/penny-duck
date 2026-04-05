import { faker } from "@faker-js/faker"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { Transaction } from "../../domain/entities/transaction.entity"
import { TransactionNotFoundError } from "../../domain/errors/transaction.errors"
import { TransactionRepository } from "../../domain/repositories/transaction.repository"
import {
  GetTransactionQuery,
  GetTransactionHandler,
} from "./get-transaction.query"

describe("GetTransactionHandler", () => {
  let handler: GetTransactionHandler
  let transactionRepo: TransactionRepository
  const userId = faker.string.uuid()

  beforeEach(() => {
    transactionRepo = {
      save: vi.fn(),
      saveTransferPair: vi.fn(),
      findById: vi.fn(),
      findByTransferId: vi.fn(),
      findAll: vi.fn(),
      delete: vi.fn(),
      deleteByTransferId: vi.fn(),
    } as unknown as TransactionRepository

    handler = new GetTransactionHandler(transactionRepo)
  })

  it("returns a transaction by id", async () => {
    const t = Transaction.fromPersistence({
      id: faker.string.uuid(),
      userId,
      accountId: faker.string.uuid(),
      type: "expense",
      amount: 50,
      categoryId: faker.string.uuid(),
      note: "lunch",
      date: new Date(),
      myShare: null,
      settled: true,
      originalAmount: null,
      originalCurrency: null,
      exchangeRate: null,
      transferId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(transactionRepo.findById).mockResolvedValue(t)

    const result = await handler.execute(
      new GetTransactionQuery(t.id, userId)
    )
    expect(result.id).toBe(t.id)
    expect(result.amount).toBe(50)
  })

  it("throws when not found", async () => {
    vi.mocked(transactionRepo.findById).mockResolvedValue(null)
    await expect(
      handler.execute(new GetTransactionQuery(faker.string.uuid(), userId))
    ).rejects.toThrow(TransactionNotFoundError)
  })
})
