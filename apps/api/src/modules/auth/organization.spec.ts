import { beforeEach, describe, expect, it } from "bun:test"
import { eq } from "drizzle-orm"
import {
  authAccounts,
  organizationMembers,
  organizations,
  users,
} from "@workspace/db"
import { honoApp } from "@/app"
import { db } from "@/db"
import { truncateAll } from "@/test/setup"
import { auth } from "./auth"
import { readInviteCode } from "./organization"

function postJson(path: string, body: unknown) {
  return honoApp.request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

function cookieFrom(res: Response): string {
  return res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ")
}

async function sessionOrgId(res: Response): Promise<string | null> {
  const result = await auth.api.getSession({
    headers: new Headers({ cookie: cookieFrom(res) }),
  })
  return (result?.session.activeOrganizationId as string | undefined) ?? null
}

async function createOrgWithInvite(code: string): Promise<string> {
  const [org] = await db
    .insert(organizations)
    .values({ name: "Inviting Org", inviteCode: code })
    .returning()
  return org.id
}

describe("readInviteCode", () => {
  it("reads from the request body", () => {
    expect(readInviteCode({ inviteCode: "abc" }, null)).toBe("abc")
  })

  it("reads from OAuth state when the body has none", () => {
    expect(readInviteCode(undefined, { inviteCode: "xyz" })).toBe("xyz")
  })

  it("ignores empty and non-string values", () => {
    expect(readInviteCode({ inviteCode: "" }, { inviteCode: 42 })).toBeNull()
    expect(readInviteCode(null, null)).toBeNull()
  })
})

describe("organization provisioning", () => {
  beforeEach(async () => {
    await truncateAll()
  })

  it("creates an owned org on sign-up without an invite", async () => {
    const res = await postJson("/auth/sign-up/email", {
      name: "Alice",
      email: "alice@example.com",
      password: "a-long-password",
    })
    expect(res.status).toBe(200)

    const [member] = await db.select().from(organizationMembers)
    expect(member.role).toBe("owner")
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, member.organizationId))
    expect(org.name).toBe("Alice's Space")
    expect(await sessionOrgId(res)).toBe(member.organizationId)
  })

  it("keeps the provisioned org name within the column length for a 100-char name", async () => {
    const res = await postJson("/auth/sign-up/email", {
      name: "x".repeat(100),
      email: "max@example.com",
      password: "a-long-password",
    })
    expect(res.status).toBe(200)

    const [member] = await db.select().from(organizationMembers)
    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, member.organizationId))
    expect(org.name.length).toBeLessThanOrEqual(100)
    expect(org.name.endsWith("'s Space")).toBe(true)
    expect(await sessionOrgId(res)).toBe(member.organizationId)
  })

  it("sets agreedToTermsAt on sign-up", async () => {
    await postJson("/auth/sign-up/email", {
      name: "Alice",
      email: "alice@example.com",
      password: "a-long-password",
    })
    const [user] = await db.select().from(users)
    expect(user.agreedToTermsAt).toBeInstanceOf(Date)
  })

  it("joins the inviting org as a member with a valid invite", async () => {
    const orgId = await createOrgWithInvite("valid-code")

    const res = await postJson("/auth/sign-up/email", {
      name: "Bob",
      email: "bob@example.com",
      password: "a-long-password",
      inviteCode: "valid-code",
    })
    expect(res.status).toBe(200)

    const members = await db.select().from(organizationMembers)
    expect(members).toHaveLength(1)
    expect(members[0].organizationId).toBe(orgId)
    expect(members[0].role).toBe("member")
    expect(await sessionOrgId(res)).toBe(orgId)
  })

  it("rejects an unknown invite code without creating a user", async () => {
    const res = await postJson("/auth/sign-up/email", {
      name: "Eve",
      email: "eve@example.com",
      password: "a-long-password",
      inviteCode: "no-such-code",
    })

    expect(res.status).toBe(400)
    expect(((await res.json()) as { code: string }).code).toBe("INVALID_INVITE")
    expect(await db.select().from(users)).toHaveLength(0)
  })

  it("rejects a name over 100 characters without creating a user", async () => {
    const res = await postJson("/auth/sign-up/email", {
      name: "x".repeat(101),
      email: "long@example.com",
      password: "a-long-password",
    })

    expect(res.status).toBe(400)
    expect(((await res.json()) as { code: string }).code).toBe("NAME_TOO_LONG")
    expect(await db.select().from(users)).toHaveLength(0)
  })

  it("rejects a blank name without creating a user", async () => {
    const res = await postJson("/auth/sign-up/email", {
      name: "   ",
      email: "blank@example.com",
      password: "a-long-password",
    })

    expect(res.status).toBe(400)
    expect(((await res.json()) as { code: string }).code).toBe("NAME_REQUIRED")
    expect(await db.select().from(users)).toHaveLength(0)
  })

  it("provisions an org when a membership-less user signs in", async () => {
    const [user] = await db
      .insert(users)
      .values({ email: "orphan@example.com", name: "Orphan" })
      .returning()
    await db.insert(authAccounts).values({
      accountId: user.id,
      providerId: "credential",
      userId: user.id,
      password: await Bun.password.hash("orphan-password", {
        algorithm: "bcrypt",
        cost: 4,
      }),
    })

    const res = await postJson("/auth/sign-in/email", {
      email: "orphan@example.com",
      password: "orphan-password",
    })
    expect(res.status).toBe(200)

    const [member] = await db.select().from(organizationMembers)
    expect(member.userId).toBe(user.id)
    expect(member.role).toBe("owner")
    expect(await sessionOrgId(res)).toBe(member.organizationId)
  })

  it("keeps the existing org on later sign-ins", async () => {
    const signup = await postJson("/auth/sign-up/email", {
      name: "Alice",
      email: "alice@example.com",
      password: "a-long-password",
    })
    const firstOrg = await sessionOrgId(signup)

    const signin = await postJson("/auth/sign-in/email", {
      email: "alice@example.com",
      password: "a-long-password",
    })

    expect(await sessionOrgId(signin)).toBe(firstOrg)
    expect(await db.select().from(organizations)).toHaveLength(1)
  })
})
