import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  it,
  expect,
} from "vitest"
import { eq } from "drizzle-orm"
import { type DbClient, organizations, users } from "@workspace/db"
import { env } from "@workspace/env/api"
import { honoApp } from "@/hono/app"
import { signAccessToken } from "@/hono/modules/auth/core/jwt"
import { ACCESS_TOKEN_COOKIE } from "@/hono/modules/auth/core/cookies"
import { generateInviteCodeService } from "@/hono/modules/auth/service"
import {
  closeTestApp,
  createTestApp,
  flushEvents,
  signupUser,
  truncateAll,
} from "@/test/setup"

let db: DbClient
let cookie: string
let userId: string
let userEmail: string
let organizationId: string

function buildCookie(payload: {
  sub: string
  email: string
  organizationId: string
}): string {
  const jwt = signAccessToken(payload, env.JWT_SECRET, env.JWT_EXPIRATION)
  return `${ACCESS_TOKEN_COOKIE}=${jwt}`
}

beforeAll(async () => {
  const ctx = await createTestApp()
  db = ctx.db
})

afterAll(() => closeTestApp())

beforeEach(async () => {
  await flushEvents()
  await truncateAll()
  const result = await signupUser({ name: "Owner", email: "owner@test.com" })
  userId = result.user.id
  userEmail = result.user.email
  organizationId = result.accessToken.organizationId
  cookie = buildCookie(result.accessToken)
})

describe("Users (Hono)", () => {
  describe("GET /users/me", () => {
    it("returns the current user", async () => {
      const res = await honoApp.request("/users/me", {
        method: "GET",
        headers: { cookie },
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.id).toBe(userId)
      expect(body.email).toBe(userEmail)
      expect(body.name).toBe("Owner")
      expect(body.homeCurrency).toBe("UAH")
    })

    it("rejects without auth", async () => {
      const res = await honoApp.request("/users/me", { method: "GET" })
      expect(res.status).toBe(401)
    })
  })

  describe("PATCH /users/me", () => {
    it("updates name", async () => {
      const res = await honoApp.request("/users/me", {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ name: "New Name" }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.name).toBe("New Name")
      expect(body.id).toBe(userId)
    })

    it("updates home currency", async () => {
      const res = await honoApp.request("/users/me", {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ homeCurrency: "USD" }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.homeCurrency).toBe("USD")
    })

    it("updates both name and currency", async () => {
      const res = await honoApp.request("/users/me", {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ name: "Updated", homeCurrency: "EUR" }),
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.name).toBe("Updated")
      expect(body.homeCurrency).toBe("EUR")
    })

    it("rejects invalid currency code", async () => {
      const res = await honoApp.request("/users/me", {
        method: "PATCH",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ homeCurrency: "ZZZ" }),
      })
      expect(res.status).toBe(400)
    })

    it("rejects without auth", async () => {
      const res = await honoApp.request("/users/me", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Anon" }),
      })
      expect(res.status).toBe(401)
    })
  })

  describe("DELETE /users/me", () => {
    it("deletes the user and sole-owned org", async () => {
      const res = await honoApp.request("/users/me", {
        method: "DELETE",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ email: userEmail }),
      })
      expect(res.status).toBe(200)

      const remainingUsers = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .limit(1)
      expect(remainingUsers).toHaveLength(0)

      const remainingOrgs = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1)
      expect(remainingOrgs).toHaveLength(0)
    })

    it("clears auth cookies on success", async () => {
      const res = await honoApp.request("/users/me", {
        method: "DELETE",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ email: userEmail }),
      })
      expect(res.status).toBe(200)
      const setCookies = res.headers.getSetCookie()
      expect(
        setCookies.some((c) => c.startsWith(`${ACCESS_TOKEN_COOKIE}=;`))
      ).toBe(true)
      expect(setCookies.some((c) => c.startsWith("refresh_token=;"))).toBe(true)
    })

    it("rejects with wrong email", async () => {
      const res = await honoApp.request("/users/me", {
        method: "DELETE",
        headers: { cookie, "content-type": "application/json" },
        body: JSON.stringify({ email: "wrong@test.com" }),
      })
      expect(res.status).toBe(400)
    })

    it("removes membership but keeps org when not sole owner", async () => {
      const inviteResult = await generateInviteCodeService(userId, organizationId)

      const member = await signupUser({
        name: "Member",
        email: "member@test.com",
        inviteCode: inviteResult.inviteCode,
      })
      const memberCookie = buildCookie(member.accessToken)

      const res = await honoApp.request("/users/me", {
        method: "DELETE",
        headers: {
          cookie: memberCookie,
          "content-type": "application/json",
        },
        body: JSON.stringify({ email: "member@test.com" }),
      })
      expect(res.status).toBe(200)

      const memberRows = await db
        .select()
        .from(users)
        .where(eq(users.id, member.user.id))
        .limit(1)
      expect(memberRows).toHaveLength(0)

      const orgRows = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1)
      expect(orgRows).toHaveLength(1)
    })

    it("rejects without auth", async () => {
      const res = await honoApp.request("/users/me", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: userEmail }),
      })
      expect(res.status).toBe(401)
    })
  })

  describe("GET /users/me/export", () => {
    it("returns aggregated user data", async () => {
      const res = await honoApp.request("/users/me/export", {
        method: "GET",
        headers: { cookie },
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.exportedAt).toBeDefined()
      expect(body.user.email).toBe(userEmail)
      expect(body.organization.id).toBe(organizationId)
      expect(body.accounts).toEqual([])
      expect(Array.isArray(body.categories)).toBe(true)
      expect(body.transactions).toEqual([])
    })

    it("rejects without auth", async () => {
      const res = await honoApp.request("/users/me/export", { method: "GET" })
      expect(res.status).toBe(401)
    })
  })

  describe("GET /users/members", () => {
    it("returns the org owner alone for a fresh signup", async () => {
      const res = await honoApp.request("/users/members", {
        method: "GET",
        headers: { cookie },
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body).toHaveLength(1)
      expect(body[0].id).toBe(userId)
      expect(body[0].role).toBe("owner")
      expect(body[0].joinedAt).toEqual(expect.any(String))
    })

    it("returns owner + invited member", async () => {
      const inviteResult = await generateInviteCodeService(userId, organizationId)
      const member = await signupUser({
        name: "Member",
        email: "member@test.com",
        inviteCode: inviteResult.inviteCode,
      })

      const res = await honoApp.request("/users/members", {
        method: "GET",
        headers: { cookie },
      })
      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body).toHaveLength(2)
      const memberRow = body.find(
        (m: { id: string }) => m.id === member.user.id
      )
      expect(memberRow).toBeDefined()
      expect(memberRow.role).toBe("member")
    })

    it("rejects without auth", async () => {
      const res = await honoApp.request("/users/members", { method: "GET" })
      expect(res.status).toBe(401)
    })
  })
})
