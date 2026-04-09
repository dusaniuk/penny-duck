import { faker } from "@faker-js/faker"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { Account } from "../../domain/entities/account.entity"
import { AccountRepository } from "../../repositories/account.repository"
import { TransactionDeletedEvent } from "../../../transactions/domain/events/transaction-deleted.event"
import { TransactionDeletedHandler } from "./transaction-deleted.handler"

describe("TransactionDeletedHandler", () => {
  let handler: TransactionDeletedHandler
  let accountRepo: AccountRepository
  const accountId = faker.string.uuid()

  const makeAccount = (balance = 800) =>
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

    handler = new TransactionDeletedHandler(accountRepo)
  })

  it("reverses expense — adds balance back", async () => {
    const account = makeAccount(800)
    vi.mocked(accountRepo.findByAccountId).mockResolvedValue(account)

    await handler.handle(
      new TransactionDeletedEvent(accountId, "expense", 200)
    )
    expect(account.balance).toBe(1000)
  })

  it("reverses income — subtracts balance", async () => {
    const account = makeAccount(1500)
    vi.mocked(accountRepo.findByAccountId).mockResolvedValue(account)

    await handler.handle(
      new TransactionDeletedEvent(accountId, "income", 500)
    )
    expect(account.balance).toBe(1000)
  })
})
