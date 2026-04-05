import { faker } from "@faker-js/faker"
import { describe, expect, it } from "vitest"
import { Transaction } from "./transaction.entity"

describe("Transaction", () => {
  const userId = faker.string.uuid()
  const accountId = faker.string.uuid()
  const categoryId = faker.string.uuid()

  describe("create", () => {
    it("creates an expense transaction", () => {
      const t = Transaction.create({
        userId,
        accountId,
        type: "expense",
        amount: 50.25,
        categoryId,
        date: new Date("2026-04-01"),
      })
      expect(t.type).toBe("expense")
      expect(t.amount).toBe(50.25)
      expect(t.categoryId).toBe(categoryId)
      expect(t.settled).toBe(true)
      expect(t.isShared).toBe(false)
    })

    it("creates an income transaction", () => {
      const t = Transaction.create({
        userId,
        accountId,
        type: "income",
        amount: 1000,
        categoryId,
        date: new Date("2026-04-01"),
      })
      expect(t.type).toBe("income")
    })

    it("creates a shared transaction as unsettled", () => {
      const t = Transaction.create({
        userId,
        accountId,
        type: "expense",
        amount: 100,
        categoryId,
        date: new Date("2026-04-01"),
        myShare: 40,
      })
      expect(t.myShare).toBe(40)
      expect(t.settled).toBe(false)
      expect(t.isShared).toBe(true)
    })

    it("creates with exchange rate", () => {
      const t = Transaction.create({
        userId,
        accountId,
        type: "expense",
        amount: 100,
        categoryId,
        date: new Date("2026-04-01"),
        originalAmount: 4152,
        originalCurrency: "UAH",
        exchangeRate: 41.52,
      })
      expect(t.exchangeRate?.originalAmount).toBe(4152)
      expect(t.exchangeRate?.originalCurrency).toBe("UAH")
      expect(t.exchangeRate?.rate).toBe(41.52)
    })

    it("rejects zero amount", () => {
      expect(() =>
        Transaction.create({
          userId,
          accountId,
          type: "expense",
          amount: 0,
          categoryId,
          date: new Date(),
        })
      ).toThrow("Amount must be greater than 0")
    })

    it("rejects negative amount", () => {
      expect(() =>
        Transaction.create({
          userId,
          accountId,
          type: "expense",
          amount: -10,
          categoryId,
          date: new Date(),
        })
      ).toThrow("Amount must be greater than 0")
    })

    it("rejects expense without categoryId", () => {
      expect(() =>
        Transaction.create({
          userId,
          accountId,
          type: "expense",
          amount: 50,
          categoryId: null,
          date: new Date(),
        })
      ).toThrow("Category is required")
    })

    it("rejects income without categoryId", () => {
      expect(() =>
        Transaction.create({
          userId,
          accountId,
          type: "income",
          amount: 50,
          categoryId: null,
          date: new Date(),
        })
      ).toThrow("Category is required")
    })

    it("rejects myShare >= amount", () => {
      expect(() =>
        Transaction.create({
          userId,
          accountId,
          type: "expense",
          amount: 100,
          categoryId,
          date: new Date(),
          myShare: 100,
        })
      ).toThrow("My share must be less than the total amount")
    })

    it("rejects myShare <= 0", () => {
      expect(() =>
        Transaction.create({
          userId,
          accountId,
          type: "expense",
          amount: 100,
          categoryId,
          date: new Date(),
          myShare: 0,
        })
      ).toThrow("My share must be greater than 0")
    })

    it("rejects partial exchange rate fields", () => {
      expect(() =>
        Transaction.create({
          userId,
          accountId,
          type: "expense",
          amount: 100,
          categoryId,
          date: new Date(),
          originalAmount: 4152,
          originalCurrency: undefined,
          exchangeRate: undefined,
        })
      ).toThrow("Exchange rate fields must all be provided or all omitted")
    })
  })

  describe("createTransferSide", () => {
    it("creates a transfer transaction without category", () => {
      const transferId = faker.string.uuid()
      const t = Transaction.createTransferSide({
        userId,
        accountId,
        amount: 100,
        date: new Date("2026-04-01"),
        transferId,
      })
      expect(t.type).toBe("transfer")
      expect(t.categoryId).toBeNull()
      expect(t.transferId).toBe(transferId)
    })
  })

  describe("markAsSettled", () => {
    it("marks a shared transaction as settled", () => {
      const t = Transaction.create({
        userId,
        accountId,
        type: "expense",
        amount: 100,
        categoryId,
        date: new Date(),
        myShare: 40,
      })
      expect(t.settled).toBe(false)
      t.markAsSettled()
      expect(t.settled).toBe(true)
    })
  })

  describe("fromPersistence", () => {
    it("reconstitutes from persistence data", () => {
      const id = faker.string.uuid()
      const t = Transaction.fromPersistence({
        id,
        userId,
        accountId,
        type: "expense",
        amount: 50,
        categoryId,
        note: "lunch",
        date: new Date("2026-04-01"),
        myShare: null,
        settled: true,
        originalAmount: null,
        originalCurrency: null,
        exchangeRate: null,
        transferId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      expect(t.id).toBe(id)
      expect(t.note).toBe("lunch")
    })
  })

  describe("update", () => {
    it("updates amount and note", () => {
      const t = Transaction.create({
        userId,
        accountId,
        type: "expense",
        amount: 50,
        categoryId,
        date: new Date(),
      })
      t.updateAmount(75)
      t.updateNote("dinner")
      expect(t.amount).toBe(75)
      expect(t.note).toBe("dinner")
    })

    it("updates myShare and resets settled", () => {
      const t = Transaction.create({
        userId,
        accountId,
        type: "expense",
        amount: 100,
        categoryId,
        date: new Date(),
      })
      t.updateMyShare(40)
      expect(t.myShare).toBe(40)
      expect(t.settled).toBe(false)
    })

    it("clears myShare and sets settled to true", () => {
      const t = Transaction.create({
        userId,
        accountId,
        type: "expense",
        amount: 100,
        categoryId,
        date: new Date(),
        myShare: 40,
      })
      t.clearMyShare()
      expect(t.myShare).toBeNull()
      expect(t.settled).toBe(true)
    })
  })
})
