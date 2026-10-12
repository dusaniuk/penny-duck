import { describe, expect, it } from "bun:test"
import { hashPassword } from "better-auth/crypto"
import { verifyPassword } from "./password"

describe("verifyPassword", () => {
  it("verifies a legacy bcrypt hash", async () => {
    const hash = await Bun.password.hash("correct-horse", {
      algorithm: "bcrypt",
      cost: 4,
    })
    expect(await verifyPassword({ hash, password: "correct-horse" })).toBe(true)
    expect(await verifyPassword({ hash, password: "wrong-horse" })).toBe(false)
  })

  it("verifies a better-auth scrypt hash", async () => {
    const hash = await hashPassword("correct-horse")
    expect(await verifyPassword({ hash, password: "correct-horse" })).toBe(true)
    expect(await verifyPassword({ hash, password: "wrong-horse" })).toBe(false)
  })
})
