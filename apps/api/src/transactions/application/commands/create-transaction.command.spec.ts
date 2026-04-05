import { faker } from "@faker-js/faker"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { EventBus } from "@nestjs/cqrs"
import { Transaction } from "../../domain/entities/transaction.entity"
import { TransactionRepository } from "../../domain/repositories/transaction.repository"
import {
  CreateTransactionCommand,
  CreateTransactionHandler,
} from "./create-transaction.command"

const mockRepo = () =>
  ({
    save: vi.fn().mockImplementation(async (t: Transaction) =>
      Transaction.fromPersistence({
        id: faker.string.uuid(),
        userId: t.userId,
        accountId: t.accountId,
        type: t.type,
        amount: t.amount,
        categoryId: t.categoryId,
        note: t.note,
        date: t.date,
        myShare: t.myShare,
        settled: t.settled,
        originalAmount: t.exchangeRate?.originalAmount ?? null,
        originalCurrency: t.exchangeRate?.originalCurrency ?? null,
        exchangeRate: t.exchangeRate?.rate ?? null,
        transferId: t.transferId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
    ),
    saveTransferPair: vi.fn(),
    findById: vi.fn(),
    findByTransferId: vi.fn(),
    findAll: vi.fn(),
    delete: vi.fn(),
    deleteByTransferId: vi.fn(),
  }) as unknown as TransactionRepository

describe("CreateTransactionHandler", () => {
  let handler: CreateTransactionHandler
  let transactionRepo: TransactionRepository
  let eventBus: EventBus

  beforeEach(() => {
    transactionRepo = mockRepo()
    eventBus = { publish: vi.fn() } as unknown as EventBus
    handler = new CreateTransactionHandler(transactionRepo, eventBus)
  })

  it("creates an expense transaction", async () => {
    const command = new CreateTransactionCommand({
      userId: faker.string.uuid(),
      accountId: faker.string.uuid(),
      type: "expense",
      amount: 50,
      categoryId: faker.string.uuid(),
      date: new Date("2026-04-01"),
      note: "lunch",
    })
    const result = await handler.execute(command)
    expect(transactionRepo.save).toHaveBeenCalledOnce()
    expect(result.type).toBe("expense")
    expect(result.amount).toBe(50)
    expect(result.note).toBe("lunch")
  })

  it("creates a shared transaction as unsettled", async () => {
    const command = new CreateTransactionCommand({
      userId: faker.string.uuid(),
      accountId: faker.string.uuid(),
      type: "expense",
      amount: 100,
      categoryId: faker.string.uuid(),
      date: new Date(),
      myShare: 40,
    })
    const result = await handler.execute(command)
    expect(result.myShare).toBe(40)
    expect(result.settled).toBe(false)
  })

  it("publishes TransactionCreatedEvent", async () => {
    const accountId = faker.string.uuid()
    const command = new CreateTransactionCommand({
      userId: faker.string.uuid(),
      accountId,
      type: "expense",
      amount: 50,
      categoryId: faker.string.uuid(),
      date: new Date(),
    })
    await handler.execute(command)
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        accountId,
        direction: "expense",
        amount: 50,
      })
    )
  })
})
