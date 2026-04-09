import { faker } from "@faker-js/faker"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { Account } from "../domain/entities/account.entity"
import { AccountRepository } from "../repositories/account.repository"
import { GetAccountsHandler, GetAccountsQuery } from "./get-accounts.query"

describe("GetAccountsHandler", () => {
  let accountRepo: AccountRepository
  let handler: GetAccountsHandler

  beforeEach(() => {
    accountRepo = {
      findAllByUserId: vi.fn(),
      findById: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockImplementation(async (a) => a),
      delete: vi.fn(),
    } as unknown as AccountRepository

    handler = new GetAccountsHandler(accountRepo)
  })

  it("returns all accounts for a userId", async () => {
    const userId = faker.string.uuid()
    const accounts: Account[] = [
      Account.fromPersistence({
        id: faker.string.uuid(),
        userId,
        name: "Bank",
        type: "bank",
        currency: "UAH",
        balance: 100,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      Account.fromPersistence({
        id: faker.string.uuid(),
        userId,
        name: "Cash",
        type: "cash",
        currency: "USD",
        balance: 50,
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    ]
    vi.mocked(accountRepo.findAllByUserId).mockResolvedValue(accounts)

    const result = await handler.execute(new GetAccountsQuery(userId))

    expect(accountRepo.findAllByUserId).toHaveBeenCalledWith(userId)
    expect(result).toBe(accounts)
    expect(result).toHaveLength(2)
  })

  it("returns empty array when user has no accounts", async () => {
    vi.mocked(accountRepo.findAllByUserId).mockResolvedValue([])

    const result = await handler.execute(
      new GetAccountsQuery(faker.string.uuid())
    )

    expect(result).toEqual([])
  })
})
