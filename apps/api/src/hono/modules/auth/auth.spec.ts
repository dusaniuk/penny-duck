import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"
import { HTTPException } from "hono/http-exception"
import { eq } from "drizzle-orm"
import {
  type DbClient,
  organizationMembers,
  organizations,
  users,
} from "@workspace/db"
import { honoApp } from "@/hono/app"
import {
  closeTestApp,
  createTestApp,
  flushEvents,
  signupUser,
  truncateAll,
} from "@/test/setup"
import { __resetRateLimitBuckets } from "./rate-limit"
import {
  generateInviteCodeService,
  getInviteService,
  loginService,
  logoutService,
  refreshService,
  signupService,
} from "./service"

let db: DbClient

beforeAll(async () => {
  const ctx = await createTestApp()
  db = ctx.db
})

afterAll(() => closeTestApp())

beforeEach(async () => {
  await flushEvents()
  await truncateAll()
  __resetRateLimitBuckets()
})

async function findOrgByUserId(userId: string) {
  const rows = await db
    .select({ id: organizations.id, name: organizations.name })
    .from(organizationMembers)
    .innerJoin(
      organizations,
      eq(organizations.id, organizationMembers.organizationId),
    )
    .where(eq(organizationMembers.userId, userId))
    .limit(1)
  return rows[0] ?? null
}

describe("Auth", () => {
  it("signs up and returns a generic success message", async () => {
    const result = await signupService({
      name: "John Doe",
      email: "john@example.com",
      password: "securePassword123",
    })
    expect(result.message).toBe("Account created successfully")
  })

  it("signup with existing email returns the same success message", async () => {
    await signupService({
      name: "User 1",
      email: "dupe@example.com",
      password: "password12345678",
    })
    const result = await signupService({
      name: "User 2",
      email: "dupe@example.com",
      password: "password12345678",
    })
    expect(result.message).toBe("Account created successfully")
  })

  it("signup seeds default categories", async () => {
    const result = await signupUser()
    const { listCategories } = await import(
      "@/hono/modules/categories/service"
    )
    const categories = await listCategories(result.accessToken.organizationId)
    expect(categories.length).toBeGreaterThan(0)
  })

  it("signs up then logs in with correct credentials", async () => {
    await signupService({
      name: "User",
      email: "login@example.com",
      password: "myPassword12345",
    })
    const result = await loginService("login@example.com", "myPassword12345")
    expect(result.user.email).toBe("login@example.com")
    expect(result.accessToken).toBeDefined()
    expect(result.refreshToken).toBeDefined()
  })

  it("rejects login with wrong password", async () => {
    await signupService({
      name: "User",
      email: "wrong@example.com",
      password: "correctPassword1",
    })
    await expect(
      loginService("wrong@example.com", "wrongPassword1"),
    ).rejects.toThrowError(HTTPException)
  })

  it("rejects login for non-existent user", async () => {
    await expect(
      loginService("noone@example.com", "password12345"),
    ).rejects.toThrowError(HTTPException)
  })

  it("refreshes tokens", async () => {
    const login = await signupUser()
    const result = await refreshService(login.refreshToken)
    expect(result.accessToken.sub).toBe(login.user.id)
    expect(result.refreshToken).toBeDefined()
    expect(result.refreshToken).not.toBe(login.refreshToken)
  })

  it("rejects refresh with old token after rotation", async () => {
    const login = await signupUser()
    const oldToken = login.refreshToken
    await refreshService(oldToken)
    await expect(refreshService(oldToken)).rejects.toThrow()
  })

  it("logs out and invalidates refresh token", async () => {
    const login = await signupUser()
    await logoutService(login.refreshToken)
    await expect(refreshService(login.refreshToken)).rejects.toThrow()
  })

  it("records agreedToTermsAt on signup", async () => {
    await signupService({
      name: "Terms User",
      email: "terms@example.com",
      password: "password12345678",
    })
    const user = await db
      .select()
      .from(users)
      .where(eq(users.email, "terms@example.com"))
      .limit(1)
    expect(user[0].agreedToTermsAt).toBeInstanceOf(Date)
  })

  describe("Invite flow", () => {
    it("getInviteService returns null when no org has that code", async () => {
      const result = await getInviteService("nonexistent")
      expect(result).toBeNull()
    })

    it("generateInviteCodeService generates code for org owner", async () => {
      const user = await signupUser()
      const result = await generateInviteCodeService(
        user.user.id,
        user.accessToken.organizationId,
      )
      expect(result.inviteCode).toBeDefined()
      expect(result.inviteCode.length).toBeGreaterThan(10)
      expect(result.inviteUrl).toContain(result.inviteCode)
    })

    it("generateInviteCodeService returns existing code if already set", async () => {
      const user = await signupUser()
      const code1 = await generateInviteCodeService(
        user.user.id,
        user.accessToken.organizationId,
      )
      const code2 = await generateInviteCodeService(
        user.user.id,
        user.accessToken.organizationId,
      )
      expect(code1.inviteCode).toBe(code2.inviteCode)
    })

    it("generateInviteCodeService rejects non-owner", async () => {
      const owner = await signupUser()
      const orgId = owner.accessToken.organizationId

      await signupService({
        name: "Member",
        email: "member@example.com",
        password: "password12345678",
      })
      const memberLogin = await loginService(
        "member@example.com",
        "password12345678",
      )

      await expect(
        generateInviteCodeService(memberLogin.user.id, orgId),
      ).rejects.toThrowError(HTTPException)
    })

    it("getInviteService returns org name for valid code", async () => {
      const user = await signupUser()
      const code = await generateInviteCodeService(
        user.user.id,
        user.accessToken.organizationId,
      )
      const org = await findOrgByUserId(user.user.id)
      const result = await getInviteService(code.inviteCode)
      expect(result).toEqual({ organizationName: org!.name })
    })

    it("signup with valid invite code adds user to existing org", async () => {
      const owner = await signupUser()
      const code = await generateInviteCodeService(
        owner.user.id,
        owner.accessToken.organizationId,
      )

      const result = await signupService({
        name: "Invited User",
        email: "invited@example.com",
        password: "password12345678",
        inviteCode: code.inviteCode,
      })
      expect(result.message).toBe("Account created successfully")

      const login = await loginService(
        "invited@example.com",
        "password12345678",
      )
      expect(login.accessToken.organizationId).toBe(
        owner.accessToken.organizationId,
      )
    })

    it("signup with invalid invite code returns generic success", async () => {
      const result = await signupService({
        name: "User",
        email: "nocode@example.com",
        password: "password12345678",
        inviteCode: "invalidcode",
      })
      expect(result.message).toBe("Account created successfully")
    })

    it("signup with invite code and existing email returns generic success", async () => {
      const owner = await signupUser()
      const code = await generateInviteCodeService(
        owner.user.id,
        owner.accessToken.organizationId,
      )
      await signupService({
        name: "Existing",
        email: "existing@example.com",
        password: "password12345678",
      })
      const result = await signupService({
        name: "Existing",
        email: "existing@example.com",
        password: "password12345678",
        inviteCode: code.inviteCode,
      })
      expect(result.message).toBe("Account created successfully")
    })
  })

  describe("HTTP layer", () => {
    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it("POST /auth/login sets access_token and refresh_token cookies", async () => {
      await signupService({
        name: "Cookie",
        email: "cookie@example.com",
        password: "password12345678",
      })
      const res = await honoApp.request("/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: "cookie@example.com",
          password: "password12345678",
        }),
      })
      expect(res.status).toBe(200)
      const setCookies = res.headers.getSetCookie()
      expect(setCookies.some((c) => c.startsWith("access_token="))).toBe(true)
      expect(setCookies.some((c) => c.startsWith("refresh_token="))).toBe(true)
    })

    it("POST /auth/logout clears both cookies", async () => {
      const login = await signupUser()
      const res = await honoApp.request("/auth/logout", {
        method: "POST",
        headers: { cookie: `refresh_token=${login.refreshToken}` },
      })
      expect(res.status).toBe(200)
      const setCookies = res.headers.getSetCookie()
      expect(setCookies.some((c) => c.startsWith("access_token=;"))).toBe(true)
      expect(setCookies.some((c) => c.startsWith("refresh_token=;"))).toBe(true)
    })

    it("POST /auth/refresh without cookie returns 401 and clears cookies", async () => {
      const res = await honoApp.request("/auth/refresh", { method: "POST" })
      expect(res.status).toBe(401)
      const setCookies = res.headers.getSetCookie()
      expect(setCookies.some((c) => c.startsWith("access_token=;"))).toBe(true)
      expect(setCookies.some((c) => c.startsWith("refresh_token=;"))).toBe(true)
    })

    it("rate limits POST /auth/login to 5/min in production", async () => {
      vi.stubEnv("NODE_ENV", "production")
      const body = JSON.stringify({
        email: "ratelimited@example.com",
        password: "wrongpassword",
      })
      const init = {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "10.0.0.1",
        },
        body,
      }
      for (let i = 0; i < 5; i++) {
        const r = await honoApp.request("/auth/login", init)
        expect(r.status).toBe(401)
      }
      const sixth = await honoApp.request("/auth/login", init)
      expect(sixth.status).toBe(429)
    })
  })
})
