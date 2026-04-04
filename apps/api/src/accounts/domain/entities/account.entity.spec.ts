import { faker } from "@faker-js/faker"
import { describe, expect, it } from "vitest"
import { Account } from "./account.entity"

describe("Account", () => {
  it("creates a new account with default balance", () => {
    const account = Account.create(
      faker.string.uuid(),
      "My Bank",
      "bank",
      "UAH"
    )
    expect(account.name).toBe("My Bank")
    expect(account.type).toBe("bank")
    expect(account.currency).toBe("UAH")
    expect(account.balance).toBe(0)
  })
  it("creates a new account with initial balance", () => {
    const account = Account.create(
      faker.string.uuid(),
      "Savings",
      "bank",
      "PLN",
      2500.5
    )
    expect(account.balance).toBe(2500.5)
  })
  it("reconstitutes from persistence", () => {
    const id = faker.string.uuid()
    const userId = faker.string.uuid()
    const account = Account.fromPersistence({
      id,
      userId,
      name: "Cash",
      type: "cash",
      currency: "USD",
      balance: 100,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    expect(account.id).toBe(id)
    expect(account.userId).toBe(userId)
  })
  it("rejects invalid currency", () => {
    expect(() =>
      Account.create(faker.string.uuid(), "Test", "bank", "XX")
    ).toThrow("Currency code must be 3 characters")
  })
  it("rejects invalid account type", () => {
    expect(() =>
      Account.create(faker.string.uuid(), "Test", "crypto", "USD")
    ).toThrow("Invalid account type")
  })
  it("updates name", () => {
    const account = Account.create(
      faker.string.uuid(),
      "Old Name",
      "bank",
      "UAH"
    )
    account.updateName("New Name")
    expect(account.name).toBe("New Name")
  })
  it("updates type", () => {
    const account = Account.create(
      faker.string.uuid(),
      "Account",
      "bank",
      "UAH"
    )
    account.updateType("cash")
    expect(account.type).toBe("cash")
  })
  it("adjusts balance", () => {
    const account = Account.create(
      faker.string.uuid(),
      "Account",
      "bank",
      "UAH",
      1000
    )
    account.adjustBalance(-200)
    expect(account.balance).toBe(800)
    account.adjustBalance(500)
    expect(account.balance).toBe(1300)
  })
})
