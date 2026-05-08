import { describe, it, expect } from "vitest"
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_MAX_AGE_MS,
  COOKIE_PATH,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_MAX_AGE_MS,
  accessTokenCookie,
  refreshTokenCookie,
} from "./cookies"

describe("cookie helpers", () => {
  it("accessTokenCookie returns a 15-minute httpOnly lax cookie", () => {
    const spec = accessTokenCookie("jwt-value")
    expect(spec.name).toBe(ACCESS_TOKEN_COOKIE)
    expect(spec.value).toBe("jwt-value")
    expect(spec.options.httpOnly).toBe(true)
    expect(spec.options.sameSite).toBe("lax")
    expect(spec.options.path).toBe(COOKIE_PATH)
    expect(spec.options.maxAge).toBe(ACCESS_TOKEN_MAX_AGE_MS)
    expect(ACCESS_TOKEN_MAX_AGE_MS).toBe(15 * 60 * 1000)
  })

  it("refreshTokenCookie returns a 7-day httpOnly lax cookie", () => {
    const spec = refreshTokenCookie("opaque-token")
    expect(spec.name).toBe(REFRESH_TOKEN_COOKIE)
    expect(spec.value).toBe("opaque-token")
    expect(spec.options.httpOnly).toBe(true)
    expect(spec.options.sameSite).toBe("lax")
    expect(spec.options.path).toBe(COOKIE_PATH)
    expect(spec.options.maxAge).toBe(REFRESH_TOKEN_MAX_AGE_MS)
    expect(REFRESH_TOKEN_MAX_AGE_MS).toBe(7 * 24 * 60 * 60 * 1000)
  })

  it("uses stable cookie names that match deployed clients", () => {
    expect(ACCESS_TOKEN_COOKIE).toBe("access_token")
    expect(REFRESH_TOKEN_COOKIE).toBe("refresh_token")
  })
})
