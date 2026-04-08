import { faker } from "@faker-js/faker"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { EventBus } from "@nestjs/cqrs"
import { Transaction } from "../../domain/entities/transaction.entity"
import { TransactionNotFoundError } from "../../domain/errors/transaction.errors"
import { TransactionRepository } from "../../domain/repositories/transaction.repository"
import {
  UpdateTransferCommand,
  UpdateTransferHandler,
} from "./update-transfer.command"

describe("UpdateTransferHandler", () => {
  let handler: UpdateTransferHandler
  let transactionRepo: TransactionRepository
  const userId = faker.string.uuid()
  const transferId = faker.string.uuid()

  const makeTransferPair = () => {
    const outgoing = Transaction.fromPersistence({
      id: faker.string.uuid(),
      userId,
      accountId: faker.string.uuid(),
      type: "transfer",
      amount: 100,
      categoryId: null,
      note: null,
      date: new Date("2026-04-01"),
      myShare: null,
      settled: true,
      originalAmount: null,
      originalCurrency: null,
      exchangeRate: null,
      transferId,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    const incoming = Transaction.fromPersistence({
      id: faker.string.uuid(),
      userId,
      accountId: faker.string.uuid(),
      type: "transfer",
      amount: 100,
      categoryId: null,
      note: null,
      date: new Date("2026-04-01"),
      myShare: null,
      settled: true,
      originalAmount: null,
      originalCurrency: null,
      exchangeRate: null,
      transferId,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    return [outgoing, incoming]
  }

  beforeEach(() => {
    transactionRepo = {
      save: vi.fn().mockImplementation(async (t) => t),
      saveTransferPair: vi.fn().mockImplementation(async (a, b) => [a, b]),
      findById: vi.fn(),
      findByTransferId: vi.fn().mockResolvedValue(makeTransferPair()),
      findAll: vi.fn(),
      delete: vi.fn(),
      deleteByTransferId: vi.fn(),
    } as unknown as TransactionRepository

    const eventBus = { publish: vi.fn() } as unknown as EventBus
    handler = new UpdateTransferHandler(transactionRepo, eventBus)
  })

  it("updates both sides of a transfer", async () => {
    const command = new UpdateTransferCommand(transferId, userId, {
      amount: 200,
      note: "updated",
    })
    const [outgoing, incoming] = await handler.execute(command)
    expect(outgoing.amount).toBe(200)
    expect(outgoing.note).toBe("updated")
    expect(incoming.amount).toBe(200)
    expect(incoming.note).toBe("updated")
  })

  it("throws when transfer not found", async () => {
    vi.mocked(transactionRepo.findByTransferId).mockResolvedValue([])
    const command = new UpdateTransferCommand(faker.string.uuid(), userId, {
      amount: 200,
    })
    await expect(handler.execute(command)).rejects.toThrow(
      TransactionNotFoundError
    )
  })

  it("updates with exchange rate — incoming gets calculated amount", async () => {
    const command = new UpdateTransferCommand(transferId, userId, {
      amount: 100,
      originalAmount: 4152,
      originalCurrency: "UAH",
      exchangeRate: 41.52,
    })
    const [outgoing, incoming] = await handler.execute(command)
    expect(outgoing.exchangeRate?.rate).toBe(41.52)
    expect(incoming.amount).toBe(4152)
  })
})
