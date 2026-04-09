import { faker } from "@faker-js/faker"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { EventBus } from "@nestjs/cqrs"
import { Transaction } from "../../domain/entities/transaction.entity"
import {
  TransactionNotFoundError,
  TransferOperationError,
} from "../../domain/errors/transaction.errors"
import { TransactionRepository } from "../../repositories/transaction.repository"
import {
  DeleteTransactionCommand,
  DeleteTransactionHandler,
} from "./delete-transaction.command"

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

describe("DeleteTransactionHandler", () => {
  let handler: DeleteTransactionHandler
  let transactionRepo: TransactionRepository
  let eventBus: EventBus

  beforeEach(() => {
    transactionRepo = {
      save: vi.fn(),
      saveTransferPair: vi.fn(),
      findById: vi.fn().mockResolvedValue(makeTransaction()),
      findByTransferId: vi.fn(),
      findAll: vi.fn(),
      delete: vi.fn(),
      deleteByTransferId: vi.fn(),
    } as unknown as TransactionRepository

    eventBus = { publish: vi.fn() } as unknown as EventBus
    handler = new DeleteTransactionHandler(transactionRepo, eventBus)
  })

  it("deletes an expense transaction", async () => {
    const t = makeTransaction()
    vi.mocked(transactionRepo.findById).mockResolvedValue(t)

    await handler.execute(new DeleteTransactionCommand(t.id, userId))
    expect(transactionRepo.delete).toHaveBeenCalledWith(t.id, userId)
  })

  it("publishes TransactionDeletedEvent", async () => {
    const t = makeTransaction()
    vi.mocked(transactionRepo.findById).mockResolvedValue(t)

    await handler.execute(new DeleteTransactionCommand(t.id, userId))
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId: t.accountId,
        direction: "expense",
        amount: t.amount,
      })
    )
  })

  it("throws when not found", async () => {
    vi.mocked(transactionRepo.findById).mockResolvedValue(null)
    await expect(
      handler.execute(
        new DeleteTransactionCommand(faker.string.uuid(), userId)
      )
    ).rejects.toThrow(TransactionNotFoundError)
  })

  it("rejects delete on transfer", async () => {
    const t = makeTransaction({
      type: "transfer",
      transferId: faker.string.uuid(),
      categoryId: null,
    })
    vi.mocked(transactionRepo.findById).mockResolvedValue(t)
    await expect(
      handler.execute(new DeleteTransactionCommand(t.id, userId))
    ).rejects.toThrow(TransferOperationError)
  })
})
