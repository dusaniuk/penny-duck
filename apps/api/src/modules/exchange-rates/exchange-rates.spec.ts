import { describe, it, expect, beforeAll, beforeEach, afterAll } from "bun:test"
import { honoApp } from "@/app"
import { createAccount } from "@/modules/accounts/service"
import {
  closeTestApp,
  createTestApp,
  signupUser,
  truncateAll,
} from "@/test/setup"

beforeAll(async () => {
  await createTestApp()
})

afterAll(() => closeTestApp())
beforeEach(() => truncateAll())

async function authedCookie(): Promise<{
  cookie: string
  organizationId: string
  userId: string
}> {
  const result = await signupUser()
  return {
    cookie: result.cookie,
    organizationId: result.organizationId,
    userId: result.userId,
  }
}

describe("GET /exchange-rates/latest", () => {
  it("returns 401 without a cookie", async () => {
    const res = await honoApp.request("/exchange-rates/latest")
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.code).toBe("UNAUTHORIZED")
  })

  it("returns 401 with an invalid cookie", async () => {
    const res = await honoApp.request("/exchange-rates/latest", {
      headers: { cookie: "penny-duck.session_token=not-a-real-session" },
    })
    expect(res.status).toBe(401)
  })

  it("returns empty rates when user has one currency", async () => {
    const { cookie, organizationId, userId } = await authedCookie()
    await createAccount({
      organizationId,
      userId,
      name: "Bank",
      type: "bank",
      currency: "UAH",
    })

    const res = await honoApp.request("/exchange-rates/latest", {
      headers: { cookie },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.rates).toEqual({})
    expect(typeof body.date).toBe("string")
  })

  it("returns cross-pairs for multiple currencies", async () => {
    const { cookie, organizationId, userId } = await authedCookie()
    await createAccount({
      organizationId,
      userId,
      name: "UAH Bank",
      type: "bank",
      currency: "UAH",
    })
    await createAccount({
      organizationId,
      userId,
      name: "USD Cash",
      type: "bank",
      currency: "USD",
    })

    const res = await honoApp.request("/exchange-rates/latest", {
      headers: { cookie },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.rates["UAH"]["USD"]).toBeGreaterThan(0)
    expect(body.rates["USD"]["UAH"]).toBeGreaterThan(0)
  })
})
