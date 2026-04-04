import { describe, expect, it } from "vitest"
import { AccountType } from "./account-type.vo"

describe("AccountType", () => {
  it("creates bank type", () => {
    expect(AccountType.create("bank").value).toBe("bank")
  })
  it("creates cash type", () => {
    expect(AccountType.create("cash").value).toBe("cash")
  })
  it("rejects invalid type", () => {
    expect(() => AccountType.create("crypto")).toThrow("Invalid account type")
  })
})
