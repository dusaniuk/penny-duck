import { faker } from "@faker-js/faker"
import { describe, expect, it } from "vitest"
import { TokenFamily } from "../value-objects/token-family.vo"
import { RefreshToken } from "./refresh-token.entity"

describe("RefreshToken", () => {
  it("issues a new token with a raw value and hashed storage", async () => {
    const userId = faker.string.uuid()
    const family = TokenFamily.create()

    const { token, rawValue } = await RefreshToken.issue(userId, family, 7)

    expect(rawValue).toBeDefined()
    expect(rawValue.length).toBeGreaterThan(0)
    expect(token.userId).toBe(userId)
    expect(token.familyId).toBe(family.value)
    expect(token.revoked).toBe(false)
    expect(token.tokenHash).not.toBe(rawValue)
  })

  it("verifies a correct raw token against the hash", async () => {
    const { token, rawValue } = await RefreshToken.issue(
      faker.string.uuid(),
      TokenFamily.create(),
      7
    )

    const matches = await token.verifyToken(rawValue)
    expect(matches).toBe(true)
  })

  it("rejects an incorrect raw token", async () => {
    const { token } = await RefreshToken.issue(
      faker.string.uuid(),
      TokenFamily.create(),
      7
    )

    const matches = await token.verifyToken("wrong-token-value")
    expect(matches).toBe(false)
  })

  it("revokes a token", async () => {
    const { token } = await RefreshToken.issue(
      faker.string.uuid(),
      TokenFamily.create(),
      7
    )

    expect(token.revoked).toBe(false)
    token.revoke()
    expect(token.revoked).toBe(true)
  })

  it("detects an expired token", async () => {
    const { token } = await RefreshToken.issue(
      faker.string.uuid(),
      TokenFamily.create(),
      -1 // expired
    )

    expect(token.isExpired()).toBe(true)
  })

  it("detects a non-expired token", async () => {
    const { token } = await RefreshToken.issue(
      faker.string.uuid(),
      TokenFamily.create(),
      7
    )

    expect(token.isExpired()).toBe(false)
  })
})
