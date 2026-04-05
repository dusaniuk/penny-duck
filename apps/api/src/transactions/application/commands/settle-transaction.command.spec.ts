import { faker } from "@faker-js/faker"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { Transaction } from "../../domain/entities/transaction.entity"
import {
  TransactionNotFoundError,
  InvalidSettlementError,
} from "../../domain/errors/transaction.errors"
import { TransactionRepository } from "../../domain/repositories/transaction.repository"
import {
  SettleTransactionCommand,
  SettleTransactionHandler,
} from "./settle-transaction.command"

const userId = faker.string.uuid()

describe("SettleTransactionHandler", () => {
  let handler: SettleTransactionHandler
  let transactionRepo: TransactionRepository

  const makeSharedTransaction = () =>
    Transaction.fromPersistence({
      id: faker.string.uuid(),
      userId,
      accountId: faker.string.uuid(),
      type: "expense",
      amount: 100,
      categoryId: faker.string.uuid(),
      note: null,
      date: new Date(),
      myShare: 40,
      settled: false,
      originalAmount: null,
      originalCurrency: null,
      exchangeRate: null,
      transferId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

  beforeEach(() => {
    transactionRepo = {
      save: vi.fn().mockImplementation(async (t) => t),
      saveTransferPair: vi.fn(),
      findById: vi.fn(),
      findByTransferId: vi.fn(),
      findAll: vi.fn(),
      delete: vi.fn(),
      deleteByTransferId: vi.fn(),
    } as unknown as TransactionRepository

    handler = new SettleTransactionHandler(transactionRepo)
  })

  it("marks a shared transaction as settled", async () => {
    const t = makeSharedTransaction()
    vi.mocked(transactionRepo.findById).mockResolvedValue(t)

    const result = await handler.execute(
      new SettleTransactionCommand(t.id, userId)
    )
    expect(result.settled).toBe(true)
    expect(transactionRepo.save).toHaveBeenCalledOnce()
  })

  it("throws when transaction not found", async () => {
    vi.mocked(transactionRepo.findById).mockResolvedValue(null)
    await expect(
      handler.execute(
        new SettleTransactionCommand(faker.string.uuid(), userId)
      )
    ).rejects.toThrow(TransactionNotFoundError)
  })

  it("throws when transaction is not shared", async () => {
    const t = Transaction.fromPersistence({
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
    })
    vi.mocked(transactionRepo.findById).mockResolvedValue(t)
    await expect(
      handler.execute(new SettleTransactionCommand(t.id, userId))
    ).rejects.toThrow(InvalidSettlementError)
  })
})
