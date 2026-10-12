import { eq } from "drizzle-orm"
import { organizationMembers, organizations, users } from "@workspace/db"
import { db } from "@/db"

export const NAME_MAX_LENGTH = 100
const ORG_NAME_MAX_LENGTH = 100
const ORG_NAME_SUFFIX = "'s Space"

function inviteCodeOf(source: unknown): string | null {
  if (typeof source !== "object" || source === null) return null
  const value = (source as Record<string, unknown>).inviteCode
  return typeof value === "string" && value.length > 0 ? value : null
}

export function readInviteCode(
  body: unknown,
  oauthState: unknown
): string | null {
  return inviteCodeOf(body) ?? inviteCodeOf(oauthState)
}

export async function findOrgIdByInviteCode(
  code: string
): Promise<string | null> {
  const rows = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.inviteCode, code))
    .limit(1)
  return rows[0]?.id ?? null
}

export async function findMembershipOrgId(
  userId: string
): Promise<string | null> {
  const rows = await db
    .select({ organizationId: organizationMembers.organizationId })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, userId))
    .limit(1)
  return rows[0]?.organizationId ?? null
}

export async function provisionMembership(
  userId: string,
  inviteCode: string | null
): Promise<string> {
  const invitedOrgId = inviteCode
    ? await findOrgIdByInviteCode(inviteCode)
    : null
  if (invitedOrgId) {
    await db.insert(organizationMembers).values({
      organizationId: invitedOrgId,
      userId,
      role: "member",
    })
    return invitedOrgId
  }

  const [user] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  return db.transaction(async (tx) => {
    const [org] = await tx
      .insert(organizations)
      .values({
        name: `${user.name.slice(0, ORG_NAME_MAX_LENGTH - ORG_NAME_SUFFIX.length)}${ORG_NAME_SUFFIX}`,
      })
      .returning({ id: organizations.id })
    await tx.insert(organizationMembers).values({
      organizationId: org.id,
      userId,
      role: "owner",
    })
    return org.id
  })
}
