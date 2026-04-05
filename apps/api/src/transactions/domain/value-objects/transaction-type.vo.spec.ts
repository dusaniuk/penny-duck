import { describe, expect, it } from "vitest"
import { TransactionType } from "./transaction-type.vo"

describe("TransactionType", () => {
  it("creates expense type", () => {
    expect(TransactionType.create("expense").value).toBe("expense")
  })
  it("creates income type", () => {
    expect(TransactionType.create("income").value).toBe("income")
  })
  it("creates transfer type", () => {
    expect(TransactionType.create("transfer").value).toBe("transfer")
  })
  it("rejects invalid type", () => {
    expect(() => TransactionType.create("refund")).toThrow(
      "Invalid transaction type"
    )
  })
})
