import { randomBytes } from "node:crypto"
import { and, eq } from "drizzle-orm"
import { HTTPException } from "hono/http-exception"
import { organizationMembers, organizations } from "@workspace/db"
import { env } from "@workspace/env/api"
import { db } from "@/db"

export async function getInvite(
  code: string
): Promise<{ organizationName: string } | null> {
  const rows = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.inviteCode, code))
    .limit(1)
  return rows[0] ? { organizationName: rows[0].name } : null
}

export async function generateInviteCode(
  userId: string,
  organizationId: string
): Promise<{ inviteCode: string; inviteUrl: string }> {
  const [membership] = await db
    .select({ role: organizationMembers.role })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.userId, userId)
      )
    )
    .limit(1)
  if (membership?.role !== "owner") {
    throw new HTTPException(403, {
      message: "Only the organization owner can generate invite links",
    })
  }

  const [org] = await db
    .select({ inviteCode: organizations.inviteCode })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1)
  let inviteCode = org?.inviteCode
  if (!inviteCode) {
    inviteCode = randomBytes(16).toString("base64url")
    await db
      .update(organizations)
      .set({ inviteCode })
      .where(eq(organizations.id, organizationId))
  }
  return { inviteCode, inviteUrl: `${env.WEB_URL}/invite?code=${inviteCode}` }
}
