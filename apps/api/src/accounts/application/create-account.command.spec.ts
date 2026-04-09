import { faker } from "@faker-js/faker"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { Account } from "../domain/entities/account.entity"
import { AccountRepository } from "../repositories/account.repository"
import {
  CreateAccountCommand,
  CreateAccountHandler,
} from "./create-account.command"

describe("CreateAccountHandler", () => {
  let accountRepo: AccountRepository
  let handler: CreateAccountHandler

  beforeEach(() => {
    accountRepo = {
      findAllByUserId: vi.fn(),
      findById: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockImplementation(async (a) => a),
      delete: vi.fn(),
    } as unknown as AccountRepository

    handler = new CreateAccountHandler(accountRepo)
  })

  it("creates and saves an account with the given fields", async () => {
    const userId = faker.string.uuid()
    const command = new CreateAccountCommand(
      userId,
      "Main Bank",
      "bank",
      "UAH",
      1000
    )

    const result = await handler.execute(command)

    expect(accountRepo.save).toHaveBeenCalledOnce()
    expect(result.userId).toBe(userId)
    expect(result.name).toBe("Main Bank")
    expect(result.type).toBe("bank")
    expect(result.currency).toBe("UAH")
    expect(result.balance).toBe(1000)
  })

  it("defaults balance to 0 when not provided", async () => {
    const command = new CreateAccountCommand(
      faker.string.uuid(),
      "Cash Wallet",
      "cash",
      "USD"
    )

    const result = await handler.execute(command)

    expect(result.balance).toBe(0)
  })

  it("returns the saved account from the repository", async () => {
    const savedAccount = Account.fromPersistence({
      id: faker.string.uuid(),
      userId: faker.string.uuid(),
      name: "Savings",
      type: "bank",
      currency: "PLN",
      balance: 500,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(accountRepo.save).mockResolvedValue(savedAccount)

    const command = new CreateAccountCommand(
      savedAccount.userId,
      "Savings",
      "bank",
      "PLN",
      500
    )
    const result = await handler.execute(command)

    expect(result).toBe(savedAccount)
  })
})
