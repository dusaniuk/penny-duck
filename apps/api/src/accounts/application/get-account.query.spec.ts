import { faker } from "@faker-js/faker"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { Account } from "../domain/entities/account.entity"
import { AccountNotFoundError } from "../domain/errors/account.errors"
import { AccountRepository } from "../domain/repositories/account.repository"
import { GetAccountHandler, GetAccountQuery } from "./get-account.query"

describe("GetAccountHandler", () => {
  let accountRepo: AccountRepository
  let handler: GetAccountHandler

  beforeEach(() => {
    accountRepo = {
      findAllByUserId: vi.fn(),
      findById: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockImplementation(async (a) => a),
      delete: vi.fn(),
    } as unknown as AccountRepository

    handler = new GetAccountHandler(accountRepo)
  })

  it("returns account when found by id and userId", async () => {
    const account = Account.fromPersistence({
      id: faker.string.uuid(),
      userId: faker.string.uuid(),
      name: "Savings",
      type: "bank",
      currency: "PLN",
      balance: 3000,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(accountRepo.findById).mockResolvedValue(account)

    const result = await handler.execute(
      new GetAccountQuery(account.id, account.userId)
    )

    expect(accountRepo.findById).toHaveBeenCalledWith(
      account.id,
      account.userId
    )
    expect(result).toBe(account)
  })

  it("throws AccountNotFoundError when account does not exist", async () => {
    vi.mocked(accountRepo.findById).mockResolvedValue(null)

    await expect(
      handler.execute(
        new GetAccountQuery(faker.string.uuid(), faker.string.uuid())
      )
    ).rejects.toThrow(AccountNotFoundError)
  })
})
