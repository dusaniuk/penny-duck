import { faker } from "@faker-js/faker"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { EventBus } from "@nestjs/cqrs"
import { Transaction } from "../../domain/entities/transaction.entity"
import { InvalidTransferError } from "../../domain/errors/transaction.errors"
import { TransactionRepository } from "../../repositories/transaction.repository"
import {
  CreateTransferCommand,
  CreateTransferHandler,
} from "./create-transfer.command"

describe("CreateTransferHandler", () => {
  let handler: CreateTransferHandler
  let transactionRepo: TransactionRepository
  let eventBus: EventBus
  const userId = faker.string.uuid()

  beforeEach(() => {
    transactionRepo = {
      save: vi.fn(),
      saveTransferPair: vi
        .fn()
        .mockImplementation(
          async (outgoing: Transaction, incoming: Transaction) => {
            const out = Transaction.fromPersistence({
              id: faker.string.uuid(),
              userId: outgoing.userId,
              accountId: outgoing.accountId,
              type: "transfer",
              amount: outgoing.amount,
              categoryId: null,
              note: outgoing.note,
              date: outgoing.date,
              myShare: null,
              settled: true,
              originalAmount: outgoing.exchangeRate?.originalAmount ?? null,
              originalCurrency:
                outgoing.exchangeRate?.originalCurrency ?? null,
              exchangeRate: outgoing.exchangeRate?.rate ?? null,
              transferId: outgoing.transferId,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            const inc = Transaction.fromPersistence({
              id: faker.string.uuid(),
              userId: incoming.userId,
              accountId: incoming.accountId,
              type: "transfer",
              amount: incoming.amount,
              categoryId: null,
              note: incoming.note,
              date: incoming.date,
              myShare: null,
              settled: true,
              originalAmount: null,
              originalCurrency: null,
              exchangeRate: null,
              transferId: incoming.transferId,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            return [out, inc]
          }
        ),
      findById: vi.fn(),
      findByTransferId: vi.fn(),
      findAll: vi.fn(),
      delete: vi.fn(),
      deleteByTransferId: vi.fn(),
    } as unknown as TransactionRepository

    eventBus = { publish: vi.fn() } as unknown as EventBus
    handler = new CreateTransferHandler(transactionRepo, eventBus)
  })

  it("creates a same-currency transfer pair", async () => {
    const fromAccountId = faker.string.uuid()
    const toAccountId = faker.string.uuid()

    const command = new CreateTransferCommand({
      userId,
      fromAccountId,
      toAccountId,
      amount: 500,
      date: new Date("2026-04-01"),
      note: "savings",
    })
    const [outgoing, incoming] = await handler.execute(command)
    expect(outgoing.type).toBe("transfer")
    expect(outgoing.accountId).toBe(fromAccountId)
    expect(outgoing.amount).toBe(500)
    expect(incoming.accountId).toBe(toAccountId)
    expect(incoming.amount).toBe(500)
    expect(outgoing.transferId).toBe(incoming.transferId)
    expect(transactionRepo.saveTransferPair).toHaveBeenCalledOnce()
  })

  it("creates a cross-currency transfer with exchange rate", async () => {
    const command = new CreateTransferCommand({
      userId,
      fromAccountId: faker.string.uuid(),
      toAccountId: faker.string.uuid(),
      amount: 100,
      date: new Date("2026-04-01"),
      originalAmount: 4152,
      originalCurrency: "UAH",
      exchangeRate: 41.52,
    })
    const [outgoing, incoming] = await handler.execute(command)
    expect(outgoing.exchangeRate?.rate).toBe(41.52)
    expect(incoming.amount).toBe(4152)
  })

  it("rejects transfer to same account", async () => {
    const accountId = faker.string.uuid()
    const command = new CreateTransferCommand({
      userId,
      fromAccountId: accountId,
      toAccountId: accountId,
      amount: 100,
      date: new Date(),
    })
    await expect(handler.execute(command)).rejects.toThrow(InvalidTransferError)
  })

  it("publishes two TransactionCreatedEvents", async () => {
    const command = new CreateTransferCommand({
      userId,
      fromAccountId: faker.string.uuid(),
      toAccountId: faker.string.uuid(),
      amount: 100,
      date: new Date(),
    })
    await handler.execute(command)
    expect(eventBus.publish).toHaveBeenCalledTimes(2)
  })
})
