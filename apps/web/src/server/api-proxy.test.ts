import { afterEach, describe, expect, it, vi } from "vitest"
import { proxyTarget } from "./api-proxy"

describe("proxyTarget", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("strips the /api prefix and keeps the query", () => {
    vi.stubEnv("API_URL", "http://api.internal:3030")
    expect(proxyTarget("https://app.example/api/users/me?x=1&y=2")).toBe(
      "http://api.internal:3030/users/me?x=1&y=2"
    )
  })

  it("reads API_URL on every call", () => {
    vi.stubEnv("API_URL", "http://first:3030")
    expect(proxyTarget("https://app.example/api/healthz")).toBe(
      "http://first:3030/healthz"
    )
    vi.stubEnv("API_URL", "http://second:3030")
    expect(proxyTarget("https://app.example/api/healthz")).toBe(
      "http://second:3030/healthz"
    )
  })

  it("defaults to the local API", () => {
    vi.stubEnv("API_URL", undefined)
    expect(proxyTarget("http://localhost:3000/api/auth/get-session")).toBe(
      "http://localhost:3030/auth/get-session"
    )
  })
})
