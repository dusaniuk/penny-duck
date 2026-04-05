import { faker } from "@faker-js/faker"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { Account } from "../../domain/entities/account.entity"
import { AccountRepository } from "../../domain/repositories/account.repository"
import { TransactionCreatedEvent } from "../../../transactions/domain/events/transaction-created.event"
import { TransactionCreatedHandler } from "./transaction-created.handler"

describe("TransactionCreatedHandler", () => {
  let handler: TransactionCreatedHandler
  let accountRepo: AccountRepository
  const accountId = faker.string.uuid()

  const makeAccount = (balance = 1000) =>
    Account.fromPersistence({
      id: accountId,
      userId: faker.string.uuid(),
      name: "Bank",
      type: "bank",
      currency: "UAH",
      balance,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

  beforeEach(() => {
    accountRepo = {
      findAllByUserId: vi.fn(),
      findById: vi.fn(),
      findByAccountId: vi.fn(),
      save: vi.fn().mockImplementation(async (a) => a),
      delete: vi.fn(),
    } as unknown as AccountRepository

    handler = new TransactionCreatedHandler(accountRepo)
  })

  it("subtracts balance for expense", async () => {
    const account = makeAccount(1000)
    vi.mocked(accountRepo.findByAccountId).mockResolvedValue(account)

    await handler.handle(
      new TransactionCreatedEvent(accountId, "expense", 200)
    )
    expect(account.balance).toBe(800)
    expect(accountRepo.save).toHaveBeenCalledOnce()
  })

  it("adds balance for income", async () => {
    const account = makeAccount(1000)
    vi.mocked(accountRepo.findByAccountId).mockResolvedValue(account)

    await handler.handle(
      new TransactionCreatedEvent(accountId, "income", 500)
    )
    expect(account.balance).toBe(1500)
    expect(accountRepo.save).toHaveBeenCalledOnce()
  })

  it("does nothing if account not found", async () => {
    vi.mocked(accountRepo.findByAccountId).mockResolvedValue(null)

    await handler.handle(
      new TransactionCreatedEvent(accountId, "expense", 200)
    )
    expect(accountRepo.save).not.toHaveBeenCalled()
  })
})
