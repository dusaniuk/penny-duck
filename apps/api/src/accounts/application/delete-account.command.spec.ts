import { faker } from "@faker-js/faker"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { Account } from "../domain/entities/account.entity"
import { AccountNotFoundError } from "../domain/errors/account.errors"
import { AccountRepository } from "../domain/repositories/account.repository"
import {
  DeleteAccountCommand,
  DeleteAccountHandler,
} from "./delete-account.command"

describe("DeleteAccountHandler", () => {
  let accountRepo: AccountRepository
  let handler: DeleteAccountHandler
  let existingAccount: Account

  beforeEach(() => {
    existingAccount = Account.fromPersistence({
      id: faker.string.uuid(),
      userId: faker.string.uuid(),
      name: "My Account",
      type: "bank",
      currency: "USD",
      balance: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    accountRepo = {
      findAllByUserId: vi.fn(),
      findById: vi.fn().mockResolvedValue(existingAccount),
      save: vi.fn().mockImplementation(async (a) => a),
      delete: vi.fn(),
    } as unknown as AccountRepository

    handler = new DeleteAccountHandler(accountRepo)
  })

  it("finds account then calls repo.delete with id and userId", async () => {
    const command = new DeleteAccountCommand(
      existingAccount.id,
      existingAccount.userId
    )

    await handler.execute(command)

    expect(accountRepo.findById).toHaveBeenCalledWith(
      existingAccount.id,
      existingAccount.userId
    )
    expect(accountRepo.delete).toHaveBeenCalledWith(
      existingAccount.id,
      existingAccount.userId
    )
  })

  it("throws AccountNotFoundError when account does not exist", async () => {
    vi.mocked(accountRepo.findById).mockResolvedValue(null)

    const command = new DeleteAccountCommand(
      faker.string.uuid(),
      faker.string.uuid()
    )

    await expect(handler.execute(command)).rejects.toThrow(AccountNotFoundError)
  })

  it("does not call delete when account is not found", async () => {
    vi.mocked(accountRepo.findById).mockResolvedValue(null)

    const command = new DeleteAccountCommand(
      faker.string.uuid(),
      faker.string.uuid()
    )

    await expect(handler.execute(command)).rejects.toThrow(AccountNotFoundError)
    expect(accountRepo.delete).not.toHaveBeenCalled()
  })
})
