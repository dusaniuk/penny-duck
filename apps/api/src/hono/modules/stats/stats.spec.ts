import { CommandBus } from "@nestjs/cqrs"
import { env } from "@workspace/env/api"
import { honoApp } from "@/hono/app"
import { signAccessToken } from "@/hono/modules/auth/core/jwt"
import { ACCESS_TOKEN_COOKIE } from "@/hono/modules/auth/core/cookies"
import { CreateAccountCommand } from "@/accounts/commands/create-account.command"
import { createTransaction } from "@/hono/modules/transactions/service"
import { listCategories } from "@/hono/modules/categories/service"
import {
  closeTestApp,
  createTestApp,
  flushEvents,
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

describe("GET /stats/monthly-summary", () => {
  it("returns 401 without a cookie", async () => {
    const res = await honoApp.request("/stats/monthly-summary")
    expect(res.status).toBe(401)
    const body = await res.json()
    expect(body.code).toBe("UNAUTHORIZED")
  })

  it("returns 401 with an invalid cookie", async () => {
    const res = await honoApp.request("/stats/monthly-summary", {
      headers: { cookie: cookieHeader("not-a-real-jwt") },
    })
    expect(res.status).toBe(401)
  })

  it("rejects an out-of-range months query param", async () => {
    const { cookie } = await authedCookie()
    const res = await honoApp.request("/stats/monthly-summary?months=50", {
      headers: { cookie },
    })
    expect(res.status).toBe(400)
  })

  it("returns the default 6 months when no query param is given", async () => {
    const { cookie } = await authedCookie()
    const res = await honoApp.request("/stats/monthly-summary", {
      headers: { cookie },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(6)
    for (const item of body) {
      expect(item.month).toMatch(/^\d{4}-\d{2}$/)
      expect(item.income).toBe(0)
      expect(item.expenses).toBe(0)
    }
  })

  it("aggregates income and expenses for the current month", async () => {
    const { cookie, organizationId, userId } = await authedCookie()
    await flushEvents()

    const account = await commandBus.execute(
      new CreateAccountCommand(organizationId, userId, "Bank", "bank", "UAH", 10000),
    )
    const categories = await listCategories(organizationId)
    const categoryId = categories[0].id

    await createTransaction({
      organizationId,
      accountId: account.id,
      type: "income",
      amount: 500,
      categoryId,
      date: new Date(),
      madeById: userId,
    })
    await createTransaction({
      organizationId,
      accountId: account.id,
      type: "expense",
      amount: 150,
      categoryId,
      date: new Date(),
      madeById: userId,
    })

    const res = await honoApp.request("/stats/monthly-summary?months=3", {
      headers: { cookie },
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveLength(3)
    const current = body[body.length - 1]
    expect(current.income).toBe(500)
    expect(current.expenses).toBe(150)
  })
})
