import { beforeEach, describe, expect, it } from "bun:test"
import { eq } from "drizzle-orm"
import { apikeys, users } from "@workspace/db"
import { honoApp } from "@/app"
import { db } from "@/db"
import { auth } from "@/modules/auth/auth"
import { signupUser, truncateAll } from "@/test/setup"

async function createKey(cookie: string, name = "Phone") {
  return auth.api.createApiKey({
    body: { name },
    headers: new Headers({ cookie }),
  })
}

describe("api keys", () => {
  beforeEach(async () => {
    await truncateAll()
  })

  it("creates a user-owned key with the inbox permission and stores a hash", async () => {
    const user = await signupUser()
    const created = await createKey(user.cookie)

    expect(created.key.startsWith("pd_")).toBe(true)
    const [row] = await db
      .select()
      .from(apikeys)
      .where(eq(apikeys.referenceId, user.userId))
    expect(row.name).toBe("Phone")
    expect(row.key).not.toBe(created.key)
    expect(row.permissions).toBe(JSON.stringify({ inbox: ["write"] }))
  })

  it("rejects permissions supplied by a browser client", async () => {
    const user = await signupUser()
    const res = await honoApp.request("/auth/api-key/create", {
      method: "POST",
      headers: { cookie: user.cookie, "content-type": "application/json" },
      body: JSON.stringify({ name: "Phone", permissions: { users: ["read"] } }),
    })
    expect(res.status).toBe(400)
  })

  it("requires a name", async () => {
    const user = await signupUser()
    const res = await honoApp.request("/auth/api-key/create", {
      method: "POST",
      headers: { cookie: user.cookie, "content-type": "application/json" },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(400)
  })

  it("verifies a key against the inbox permission only", async () => {
    const user = await signupUser()
    const created = await createKey(user.cookie)

    const ok = await auth.api.verifyApiKey({
      body: { key: created.key, permissions: { inbox: ["write"] } },
    })
    expect(ok.valid).toBe(true)
    expect(ok.key?.referenceId).toBe(user.userId)

    const denied = await auth.api.verifyApiKey({
      body: { key: created.key, permissions: { users: ["read"] } },
    })
    expect(denied.valid).toBe(false)

    const unknown = await auth.api.verifyApiKey({
      body: { key: "pd_not_a_key", permissions: { inbox: ["write"] } },
    })
    expect(unknown.valid).toBe(false)
  })

  it("stops verifying a deleted key", async () => {
    const user = await signupUser()
    const created = await createKey(user.cookie)
    await auth.api.deleteApiKey({
      body: { keyId: created.id },
      headers: new Headers({ cookie: user.cookie }),
    })
    const result = await auth.api.verifyApiKey({
      body: { key: created.key, permissions: { inbox: ["write"] } },
    })
    expect(result.valid).toBe(false)
  })

  it("cascades keys when the user is deleted", async () => {
    const user = await signupUser()
    await createKey(user.cookie)
    await db.delete(users).where(eq(users.id, user.userId))
    expect(await db.select().from(apikeys)).toHaveLength(0)
  })
})
