import { faker } from "@faker-js/faker"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { Account } from "../domain/entities/account.entity"
import { AccountNotFoundError } from "../domain/errors/account.errors"
import { AccountRepository } from "../repositories/account.repository"
import {
  UpdateAccountCommand,
  UpdateAccountHandler,
} from "./update-account.command"

describe("UpdateAccountHandler", () => {
  let accountRepo: AccountRepository
  let handler: UpdateAccountHandler
  let existingAccount: Account

  beforeEach(() => {
    existingAccount = Account.fromPersistence({
      id: faker.string.uuid(),
      userId: faker.string.uuid(),
      name: "Old Name",
      type: "bank",
      currency: "UAH",
      balance: 200,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    accountRepo = {
      findAllByUserId: vi.fn(),
      findById: vi.fn().mockResolvedValue(existingAccount),
      save: vi.fn().mockImplementation(async (a) => a),
      delete: vi.fn(),
    } as unknown as AccountRepository

    handler = new UpdateAccountHandler(accountRepo)
  })

  it("finds account by id and userId, updates name, and saves", async () => {
    const command = new UpdateAccountCommand(
      existingAccount.id,
      existingAccount.userId,
      "New Name"
    )

    await handler.execute(command)

    expect(accountRepo.findById).toHaveBeenCalledWith(
      existingAccount.id,
      existingAccount.userId
    )
    expect(accountRepo.save).toHaveBeenCalledOnce()
    const saved = vi.mocked(accountRepo.save).mock.calls[0][0]
    expect(saved.name).toBe("New Name")
  })

  it("updates type when provided", async () => {
    const command = new UpdateAccountCommand(
      existingAccount.id,
      existingAccount.userId,
      undefined,
      "cash"
    )

    await handler.execute(command)

    const saved = vi.mocked(accountRepo.save).mock.calls[0][0]
    expect(saved.type).toBe("cash")
  })

  it("updates both name and type when both provided", async () => {
    const command = new UpdateAccountCommand(
      existingAccount.id,
      existingAccount.userId,
      "Updated Name",
      "cash"
    )

    await handler.execute(command)

    const saved = vi.mocked(accountRepo.save).mock.calls[0][0]
    expect(saved.name).toBe("Updated Name")
    expect(saved.type).toBe("cash")
  })

  it("throws AccountNotFoundError when account does not exist", async () => {
    vi.mocked(accountRepo.findById).mockResolvedValue(null)

    const command = new UpdateAccountCommand(
      faker.string.uuid(),
      faker.string.uuid(),
      "Name"
    )

    await expect(handler.execute(command)).rejects.toThrow(AccountNotFoundError)
  })
})
