import { faker } from "@faker-js/faker"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { EventBus } from "@nestjs/cqrs"
import { Transaction } from "../../domain/entities/transaction.entity"
import { TransactionNotFoundError } from "../../domain/errors/transaction.errors"
import { TransactionRepository } from "../../domain/repositories/transaction.repository"
import { TransactionCreatedEvent } from "../../domain/events/transaction-created.event"
import { TransactionDeletedEvent } from "../../domain/events/transaction-deleted.event"
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
  let eventBus: EventBus

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

    eventBus = { publish: vi.fn() } as unknown as EventBus
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

  it("publishes balance decrease event when expense amount increases", async () => {
    const t = makeTransaction({ amount: 100 })
    vi.mocked(transactionRepo.findById).mockResolvedValue(t)

    await handler.execute(
      new UpdateTransactionCommand(t.id, userId, { amount: 200 })
    )

    // Expense 100→200: balance should decrease by 100
    expect(eventBus.publish).toHaveBeenCalledTimes(1)
    expect(eventBus.publish).toHaveBeenCalledWith(
      new TransactionCreatedEvent(t.accountId!, "expense", 100)
    )
  })

  it("publishes balance increase event when expense amount decreases", async () => {
    const t = makeTransaction({ amount: 6000 })
    vi.mocked(transactionRepo.findById).mockResolvedValue(t)

    await handler.execute(
      new UpdateTransactionCommand(t.id, userId, { amount: 600 })
    )

    // Expense 6000→600: balance should increase by 5400
    expect(eventBus.publish).toHaveBeenCalledTimes(1)
    expect(eventBus.publish).toHaveBeenCalledWith(
      new TransactionDeletedEvent(t.accountId!, "expense", 5400)
    )
  })

  it("publishes balance increase event when income amount increases", async () => {
    const t = makeTransaction({ amount: 100, type: "income" })
    vi.mocked(transactionRepo.findById).mockResolvedValue(t)

    await handler.execute(
      new UpdateTransactionCommand(t.id, userId, { amount: 500 })
    )

    // Income 100→500: balance should increase by 400
    expect(eventBus.publish).toHaveBeenCalledTimes(1)
    expect(eventBus.publish).toHaveBeenCalledWith(
      new TransactionDeletedEvent(t.accountId!, "expense", 400)
    )
  })

  it("does not publish balance events when amount unchanged", async () => {
    const t = makeTransaction({ amount: 50 })
    vi.mocked(transactionRepo.findById).mockResolvedValue(t)

    await handler.execute(
      new UpdateTransactionCommand(t.id, userId, { note: "updated" })
    )

    expect(eventBus.publish).not.toHaveBeenCalled()
  })

  it("does not publish balance events for orphaned transactions", async () => {
    const t = makeTransaction({ amount: 100, accountId: null })
    vi.mocked(transactionRepo.findById).mockResolvedValue(t)

    await handler.execute(
      new UpdateTransactionCommand(t.id, userId, { amount: 200 })
    )

    expect(eventBus.publish).not.toHaveBeenCalled()
  })
})
