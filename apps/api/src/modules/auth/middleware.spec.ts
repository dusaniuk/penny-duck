import { beforeEach, describe, expect, it } from "bun:test"
import { eq } from "drizzle-orm"
import { organizations, sessions } from "@workspace/db"
import { honoApp } from "@/app"
import { db } from "@/db"
import { signupUser, truncateAll } from "@/test/setup"

function sessionTokenOnly(cookie: string): string {
  return cookie
    .split("; ")
    .filter((c) => c.includes("session_token="))
    .join("; ")
}

describe("auth middleware", () => {
  beforeEach(async () => {
    await truncateAll()
  })

  it("returns 401 without a cookie", async () => {
    const res = await honoApp.request("/users/me")
    expect(res.status).toBe(401)
  })

  it("authenticates a signed-up user", async () => {
    const user = await signupUser()
    const res = await honoApp.request("/users/me", {
      headers: { cookie: user.cookie },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { id: string; email: string }
    expect(body.id).toBe(user.userId)
  })

  it("returns 401 after sign-out", async () => {
    const user = await signupUser()
    await honoApp.request("/auth/sign-out", {
      method: "POST",
      headers: { cookie: user.cookie },
    })

    const res = await honoApp.request("/users/me", {
      headers: { cookie: sessionTokenOnly(user.cookie) },
    })
    expect(res.status).toBe(401)
  })

  it("returns 401 when the session's organization was deleted", async () => {
    const user = await signupUser()
    await db
      .delete(organizations)
      .where(eq(organizations.id, user.organizationId))

    const res = await honoApp.request("/users/me", {
      headers: { cookie: sessionTokenOnly(user.cookie) },
    })
    expect(res.status).toBe(401)
    const [session] = await db.select().from(sessions)
    expect(session.activeOrganizationId).toBeNull()
  })

  it("clears auth cookies and the session when the account is deleted", async () => {
    const user = await signupUser()

    const res = await honoApp.request("/users/me", {
      method: "DELETE",
      headers: { cookie: user.cookie, "content-type": "application/json" },
      body: JSON.stringify({ email: user.email }),
    })

    expect(res.status).toBe(200)
    const cleared = res.headers.getSetCookie().join("\n")
    expect(cleared).toMatch(/penny-duck\.session_token=;.*Max-Age=0/)
    expect(cleared).toMatch(/penny-duck\.session_data=;.*Max-Age=0/)
    const after = await honoApp.request("/users/me", {
      headers: { cookie: sessionTokenOnly(user.cookie) },
    })
    expect(after.status).toBe(401)
  })
})
