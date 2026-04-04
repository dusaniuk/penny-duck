import { faker } from "@faker-js/faker"
import { describe, expect, it } from "vitest"
import { Password } from "./password.vo"

describe("Password", () => {
  it("rejects a password shorter than 8 characters", () => {
    expect(() => Password.create("short")).toThrow(
      "Password must be at least 8 characters"
    )
  })

  it("rejects a password longer than 128 characters", () => {
    const long = "a".repeat(129)
    expect(() => Password.create(long)).toThrow(
      "Password must be at most 128 characters"
    )
  })

  it("creates a valid password and hashes it", async () => {
    const raw = faker.internet.password({ length: 16 })
    const password = Password.create(raw)
    const hash = await password.hash()
    expect(hash).not.toBe(raw)
    expect(hash.startsWith("$2")).toBe(true)
  })

  it("verifies a correct password against its hash", async () => {
    const raw = faker.internet.password({ length: 16 })
    const password = Password.create(raw)
    const hash = await password.hash()
    const matches = await Password.verify(raw, hash)
    expect(matches).toBe(true)
  })

  it("rejects an incorrect password against a hash", async () => {
    const raw = faker.internet.password({ length: 16 })
    const password = Password.create(raw)
    const hash = await password.hash()
    const matches = await Password.verify("wrong-password!", hash)
    expect(matches).toBe(false)
  })
})
