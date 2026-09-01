import { describe, it, expect } from "bun:test"
import jwt from "jsonwebtoken"
import {
  signAccessToken,
  verifyAccessToken,
  type AccessTokenPayload,
} from "./jwt"

const SECRET = "test-secret-please-do-not-use-in-prod-32"
const PAYLOAD: AccessTokenPayload = {
  sub: "user-1",
  email: "alice@example.com",
  organizationId: "org-1",
}

describe("signAccessToken / verifyAccessToken", () => {
  it("round-trips a payload", () => {
    const token = signAccessToken(PAYLOAD, SECRET, "15m")
    expect(verifyAccessToken(token, SECRET)).toEqual(PAYLOAD)
  })

  it("returns null for tampered signature", () => {
    const token = signAccessToken(PAYLOAD, SECRET, "15m")
    const [h, p] = token.split(".")
    const tampered = `${h}.${p}.invalidsignature`
    expect(verifyAccessToken(tampered, SECRET)).toBeNull()
  })

  it("returns null when verifying with wrong secret", () => {
    const token = signAccessToken(PAYLOAD, SECRET, "15m")
    expect(
      verifyAccessToken(token, "different-secret-also-32-chars-long")
    ).toBeNull()
  })

  it("returns null for expired token", () => {
    const token = jwt.sign(PAYLOAD, SECRET, { expiresIn: -1 })
    expect(verifyAccessToken(token, SECRET)).toBeNull()
  })

  it("returns null for garbage input", () => {
    expect(verifyAccessToken("not-a-jwt", SECRET)).toBeNull()
    expect(verifyAccessToken("", SECRET)).toBeNull()
  })

  it("returns null when payload is missing required fields", () => {
    const token = jwt.sign({ sub: "x" }, SECRET, { expiresIn: "15m" })
    expect(verifyAccessToken(token, SECRET)).toBeNull()
  })
})
