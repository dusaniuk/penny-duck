import { faker } from "@faker-js/faker"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { Account } from "../domain/entities/account.entity"
import {
  AccountNotFoundError,
  AccountHasTransactionsError,
} from "../domain/errors/account.errors"
import { AccountRepository } from "../repositories/account.repository"
import { TransactionRepository } from "../../transactions/repositories/transaction.repository"
import {
  DeleteAccountCommand,
  DeleteAccountHandler,
} from "./delete-account.command"

describe("DeleteAccountHandler", () => {
  let accountRepo: AccountRepository
  let transactionRepo: TransactionRepository
  let handler: DeleteAccountHandler
  const userId = faker.string.uuid()
  const accountId = faker.string.uuid()

  const makeAccount = (id = accountId) =>
    Account.fromPersistence({
      id,
      userId,
      name: "Test",
      type: "bank",
      currency: "USD",
      balance: 1000,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

  beforeEach(() => {
    accountRepo = {
      findById: vi.fn().mockResolvedValue(makeAccount()),
      save: vi.fn(),
      delete: vi.fn(),
    } as unknown as AccountRepository

    transactionRepo = {
      countByAccountId: vi.fn().mockResolvedValue(0),
    } as unknown as TransactionRepository

    handler = new DeleteAccountHandler(accountRepo, transactionRepo)
  })

  it("throws AccountNotFoundError when account does not exist", async () => {
    vi.mocked(accountRepo.findById).mockResolvedValue(null)
    await expect(
      handler.execute(new DeleteAccountCommand(accountId, userId))
    ).rejects.toThrow(AccountNotFoundError)
  })

  it("throws AccountHasTransactionsError when account has transactions", async () => {
    vi.mocked(transactionRepo.countByAccountId).mockResolvedValue(5)
    await expect(
      handler.execute(new DeleteAccountCommand(accountId, userId))
    ).rejects.toThrow(AccountHasTransactionsError)
  })

  it("includes transaction count in the error", async () => {
    vi.mocked(transactionRepo.countByAccountId).mockResolvedValue(42)
    await expect(
      handler.execute(new DeleteAccountCommand(accountId, userId))
    ).rejects.toThrow("42 transactions")
  })

  it("deletes account when no transactions exist", async () => {
    vi.mocked(transactionRepo.countByAccountId).mockResolvedValue(0)
    await handler.execute(new DeleteAccountCommand(accountId, userId))
    expect(accountRepo.delete).toHaveBeenCalledWith(accountId, userId)
  })
})
