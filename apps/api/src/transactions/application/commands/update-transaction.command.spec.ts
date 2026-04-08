import { faker } from "@faker-js/faker"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { EventBus } from "@nestjs/cqrs"
import { Transaction } from "../../domain/entities/transaction.entity"
import { TransactionNotFoundError } from "../../domain/errors/transaction.errors"
import { TransactionRepository } from "../../domain/repositories/transaction.repository"
import {
  UpdateTransactionCommand,
  UpdateTransactionHandler,
} from "./update-transaction.command"

const userId = faker.string.uuid()

const makeTransaction = (overrides = {}) =>
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
    ...overrides,
  })

describe("UpdateTransactionHandler", () => {
  let handler: UpdateTransactionHandler
  let transactionRepo: TransactionRepository

  beforeEach(() => {
    transactionRepo = {
      save: vi.fn().mockImplementation(async (t) => t),
      saveTransferPair: vi.fn(),
      findById: vi.fn().mockResolvedValue(makeTransaction()),
      findByTransferId: vi.fn(),
      findAll: vi.fn(),
      delete: vi.fn(),
      deleteByTransferId: vi.fn(),
    } as unknown as TransactionRepository

    const eventBus = { publish: vi.fn() } as unknown as EventBus
    handler = new UpdateTransactionHandler(transactionRepo, eventBus)
  })

  it("updates amount and note", async () => {
    const t = makeTransaction()
    vi.mocked(transactionRepo.findById).mockResolvedValue(t)

    const command = new UpdateTransactionCommand(t.id, userId, {
      amount: 75,
      note: "dinner",
    })
    const result = await handler.execute(command)
    expect(result.amount).toBe(75)
    expect(result.note).toBe("dinner")
    expect(transactionRepo.save).toHaveBeenCalledOnce()
  })

  it("throws when transaction not found", async () => {
    vi.mocked(transactionRepo.findById).mockResolvedValue(null)
    const command = new UpdateTransactionCommand(faker.string.uuid(), userId, {
      amount: 75,
    })
    await expect(handler.execute(command)).rejects.toThrow(
      TransactionNotFoundError
    )
  })

  it("rejects update on transfer transactions", async () => {
    const t = makeTransaction({
      type: "transfer",
      transferId: faker.string.uuid(),
      categoryId: null,
    })
    vi.mocked(transactionRepo.findById).mockResolvedValue(t)

    const command = new UpdateTransactionCommand(t.id, userId, { amount: 75 })
    await expect(handler.execute(command)).rejects.toThrow(
      "Use the transfer endpoint"
    )
  })
})
