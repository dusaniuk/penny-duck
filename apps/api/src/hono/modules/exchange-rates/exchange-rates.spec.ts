import { CommandBus } from "@nestjs/cqrs"
import { env } from "@workspace/env/api"
import { honoApp } from "@/hono/app"
import { signAccessToken } from "@/hono/modules/auth/core/jwt"
import { ACCESS_TOKEN_COOKIE } from "@/hono/modules/auth/core/cookies"
import { CreateAccountCommand } from "@/accounts/commands/create-account.command"
import {
  closeTestApp,
  createTestApp,
  signupUser,
  truncateAll,
} from "@/test/setup"

let commandBus: CommandBus

beforeAll(async () => {
  const ctx = await createTestApp()
  commandBus = ctx.commandBus
})

afterAll(() => closeTestApp())
beforeEach(() => truncateAll())

function cookieHeader(jwt: string): string {
  return `${ACCESS_TOKEN_COOKIE}=${jwt}`
}

async function authedCookie(): Promise<{
  cookie: string
  organizationId: string
  userId: string
}> {
  const result = await signupUser()
  const jwt = signAccessToken(
    result.accessToken,
    env.JWT_SECRET,
    env.JWT_EXPIRATION,
  )
  return {
    cookie: cookieHeader(jwt),
    organizationId: result.accessToken.organizationId,
    userId: result.accessToken.sub,
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
      headers: { cookie: cookieHeader("not-a-real-jwt") },
    })
    expect(res.status).toBe(401)
  })

  it("returns empty rates when user has one currency", async () => {
    const { cookie, organizationId, userId } = await authedCookie()
    await commandBus.execute(
      new CreateAccountCommand(organizationId, userId, "Bank", "bank", "UAH"),
    )

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
    await commandBus.execute(
      new CreateAccountCommand(organizationId, userId, "UAH Bank", "bank", "UAH"),
    )
    await commandBus.execute(
      new CreateAccountCommand(organizationId, userId, "USD Cash", "cash", "USD"),
    )

    const res = await honoApp.request("/exchange-rates/latest", {
      headers: { cookie },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.rates["UAH"]["USD"]).toBeGreaterThan(0)
    expect(body.rates["USD"]["UAH"]).toBeGreaterThan(0)
  })
})
