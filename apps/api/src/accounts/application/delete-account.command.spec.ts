import { faker } from "@faker-js/faker"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { Account } from "../domain/entities/account.entity"
import { AccountNotFoundError } from "../domain/errors/account.errors"
import { AccountRepository } from "../domain/repositories/account.repository"
import { TransactionRepository } from "../../transactions/domain/repositories/transaction.repository"
import { Transaction } from "../../transactions/domain/entities/transaction.entity"
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

  const makeAccount = (id = accountId, balance = 1000) =>
    Account.fromPersistence({
      id,
      userId,
      name: "Test",
      type: "bank",
      currency: "USD",
      balance,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

  beforeEach(() => {
    accountRepo = {
      findAllByUserId: vi.fn(),
      findById: vi.fn().mockResolvedValue(makeAccount()),
      findByAccountId: vi.fn(),
      save: vi.fn().mockImplementation(async (a) => a),
      delete: vi.fn(),
    } as unknown as AccountRepository

    transactionRepo = {
      save: vi.fn().mockImplementation(async (t) => t),
      saveTransferPair: vi.fn(),
      findById: vi.fn(),
      findByTransferId: vi.fn().mockResolvedValue([]),
      findAll: vi.fn(),
      findAllByAccountId: vi.fn().mockResolvedValue([]),
      countByAccountId: vi.fn().mockResolvedValue(0),
      updateAccountIdBulk: vi.fn(),
      delete: vi.fn(),
      deleteByAccountId: vi.fn(),
      deleteByTransferId: vi.fn(),
    } as unknown as TransactionRepository

    handler = new DeleteAccountHandler(accountRepo, transactionRepo)
  })

  it("throws AccountNotFoundError when account does not exist", async () => {
    vi.mocked(accountRepo.findById).mockResolvedValue(null)
    await expect(
      handler.execute(
        new DeleteAccountCommand({ id: accountId, userId, mode: "delete" })
      )
    ).rejects.toThrow(AccountNotFoundError)
  })

  describe("mode: delete", () => {
    it("deletes all transactions then deletes account", async () => {
      await handler.execute(
        new DeleteAccountCommand({ id: accountId, userId, mode: "delete" })
      )
      expect(transactionRepo.deleteByAccountId).toHaveBeenCalledWith(accountId)
      expect(accountRepo.delete).toHaveBeenCalledWith(accountId, userId)
    })
  })

  describe("mode: orphan", () => {
    it("sets accountId to null on all transactions then deletes account", async () => {
      await handler.execute(
        new DeleteAccountCommand({ id: accountId, userId, mode: "orphan" })
      )
      expect(transactionRepo.updateAccountIdBulk).toHaveBeenCalledWith(
        accountId,
        null
      )
      expect(accountRepo.delete).toHaveBeenCalledWith(accountId, userId)
    })
  })

  describe("mode: move", () => {
    it("moves transactions to target account and adjusts balance", async () => {
      const targetId = faker.string.uuid()
      const target = makeAccount(targetId, 500)
      vi.mocked(accountRepo.findById).mockImplementation(async (id) => {
        if (id === accountId) return makeAccount()
        if (id === targetId) return target
        return null
      })

      const expense = Transaction.fromPersistence({
        id: faker.string.uuid(),
        userId,
        accountId,
        type: "expense",
        amount: 100,
        categoryId: faker.string.uuid(),
        note: null,
        date: new Date(),
        myShare: null,
        settled: true,
        originalAmount: null,
        originalCurrency: null,
        exchangeRate: null,
        transferId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      vi.mocked(transactionRepo.findAllByAccountId).mockResolvedValue([expense])

      await handler.execute(
        new DeleteAccountCommand({
          id: accountId,
          userId,
          mode: "move",
          targetAccountId: targetId,
        })
      )

      expect(transactionRepo.updateAccountIdBulk).toHaveBeenCalledWith(
        accountId,
        targetId
      )
      expect(target.balance).toBe(400)
      expect(accountRepo.save).toHaveBeenCalledWith(target)
      expect(accountRepo.delete).toHaveBeenCalledWith(accountId, userId)
    })

    it("throws when target account not provided", async () => {
      await expect(
        handler.execute(
          new DeleteAccountCommand({ id: accountId, userId, mode: "move" })
        )
      ).rejects.toThrow("Target account is required")
    })

    it("throws when target is same as source", async () => {
      await expect(
        handler.execute(
          new DeleteAccountCommand({
            id: accountId,
            userId,
            mode: "move",
            targetAccountId: accountId,
          })
        )
      ).rejects.toThrow("Target account must differ")
    })
  })

  describe("transfer link breaking", () => {
    it("breaks transfer links on orphan mode", async () => {
      const transferId = faker.string.uuid()
      const current = Transaction.fromPersistence({
        id: faker.string.uuid(),
        userId,
        accountId,
        type: "transfer",
        amount: 100,
        categoryId: null,
        note: null,
        date: new Date(),
        myShare: null,
        settled: true,
        originalAmount: 4152,
        originalCurrency: "UAH",
        exchangeRate: 41.52,
        transferId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      const partner = Transaction.fromPersistence({
        id: faker.string.uuid(),
        userId,
        accountId: faker.string.uuid(),
        type: "transfer",
        amount: 4152,
        categoryId: null,
        note: null,
        date: new Date(),
        myShare: null,
        settled: true,
        originalAmount: null,
        originalCurrency: null,
        exchangeRate: null,
        transferId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      vi.mocked(transactionRepo.findAllByAccountId).mockResolvedValue([current])
      vi.mocked(transactionRepo.findByTransferId).mockResolvedValue([
        current,
        partner,
      ])

      await handler.execute(
        new DeleteAccountCommand({ id: accountId, userId, mode: "orphan" })
      )

      expect(transactionRepo.save).toHaveBeenCalledTimes(2)
      expect(partner.transferId).toBeNull()
      expect(partner.type).toBe("income")
      expect(current.transferId).toBeNull()
      expect(current.type).toBe("expense")
    })
  })
})
