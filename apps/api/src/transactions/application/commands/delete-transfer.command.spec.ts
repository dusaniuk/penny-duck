import { faker } from "@faker-js/faker"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { EventBus } from "@nestjs/cqrs"
import { Transaction } from "../../domain/entities/transaction.entity"
import { TransactionNotFoundError } from "../../domain/errors/transaction.errors"
import { TransactionRepository } from "../../repositories/transaction.repository"
import {
  DeleteTransferCommand,
  DeleteTransferHandler,
} from "./delete-transfer.command"

describe("DeleteTransferHandler", () => {
  let handler: DeleteTransferHandler
  let transactionRepo: TransactionRepository
  let eventBus: EventBus
  const userId = faker.string.uuid()
  const transferId = faker.string.uuid()

  const makeTransferPair = () => [
    Transaction.fromPersistence({
      id: faker.string.uuid(),
      userId,
      accountId: faker.string.uuid(),
      type: "transfer",
      amount: 100,
      categoryId: null,
      note: null,
      date: new Date(),
      myShare: null,
      settled: true,
      originalAmount: null,
      originalCurrency: null,
      exchangeRate: null,
      transferId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
    Transaction.fromPersistence({
      id: faker.string.uuid(),
      userId,
      accountId: faker.string.uuid(),
      type: "transfer",
      amount: 100,
      categoryId: null,
      note: null,
      date: new Date(),
      myShare: null,
      settled: true,
      originalAmount: null,
      originalCurrency: null,
      exchangeRate: null,
      transferId,
      createdAt: new Date(),
      updatedAt: new Date(),
    }),
  ]

  beforeEach(() => {
    transactionRepo = {
      save: vi.fn(),
      saveTransferPair: vi.fn(),
      findById: vi.fn(),
      findByTransferId: vi.fn().mockResolvedValue(makeTransferPair()),
      findAll: vi.fn(),
      delete: vi.fn(),
      deleteByTransferId: vi.fn(),
    } as unknown as TransactionRepository

    eventBus = { publish: vi.fn() } as unknown as EventBus
    handler = new DeleteTransferHandler(transactionRepo, eventBus)
  })

  it("deletes both sides of a transfer", async () => {
    await handler.execute(new DeleteTransferCommand(transferId, userId))
    expect(transactionRepo.deleteByTransferId).toHaveBeenCalledWith(transferId)
  })

  it("publishes two TransactionDeletedEvents", async () => {
    await handler.execute(new DeleteTransferCommand(transferId, userId))
    expect(eventBus.publish).toHaveBeenCalledTimes(2)
  })

  it("throws when transfer not found", async () => {
    vi.mocked(transactionRepo.findByTransferId).mockResolvedValue([])
    await expect(
      handler.execute(new DeleteTransferCommand(faker.string.uuid(), userId))
    ).rejects.toThrow(TransactionNotFoundError)
  })
})
