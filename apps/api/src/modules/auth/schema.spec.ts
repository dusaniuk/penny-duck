import { beforeEach, describe, expect, it } from "bun:test"
import { eq } from "drizzle-orm"
import { authAccounts, organizations, sessions, users } from "@workspace/db"
import { db } from "@/db"
import { truncateAll } from "@/test/setup"

async function insertUser() {
  const [user] = await db
    .insert(users)
    .values({ email: `${crypto.randomUUID()}@example.com`, name: "Test" })
    .returning()
  return user
}

describe("auth schema", () => {
  beforeEach(async () => {
    await truncateAll()
  })

  it("deletes sessions and accounts when the user is deleted", async () => {
    const user = await insertUser()
    await db.insert(sessions).values({
      token: crypto.randomUUID(),
      userId: user.id,
      expiresAt: new Date(Date.now() + 60_000),
    })
    await db.insert(authAccounts).values({
      accountId: user.id,
      providerId: "credential",
      userId: user.id,
      password: "hash",
    })

    await db.delete(users).where(eq(users.id, user.id))

    expect(await db.select().from(sessions)).toHaveLength(0)
    expect(await db.select().from(authAccounts)).toHaveLength(0)
  })

  it("nulls activeOrganizationId when the organization is deleted", async () => {
    const user = await insertUser()
    const [org] = await db
      .insert(organizations)
      .values({ name: "Org" })
      .returning()
    await db.insert(sessions).values({
      token: crypto.randomUUID(),
      userId: user.id,
      activeOrganizationId: org.id,
      expiresAt: new Date(Date.now() + 60_000),
    })

    await db.delete(organizations).where(eq(organizations.id, org.id))

    const [session] = await db.select().from(sessions)
    expect(session.activeOrganizationId).toBeNull()
  })

  it("rejects two accounts for the same provider identity", async () => {
    const user = await insertUser()
    const values = {
      accountId: "google-sub-1",
      providerId: "google",
      userId: user.id,
    }
    await db.insert(authAccounts).values(values)
    await expect(
      (async () => db.insert(authAccounts).values(values))()
    ).rejects.toThrow()
  })
})
