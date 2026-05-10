import { and, eq, ne } from "drizzle-orm"
import { organizationMembers, organizations, users } from "@workspace/db"
import { db } from "@/hono/db"

export interface MembershipRow {
  organizationId: string
  role: string
}

export async function findUserMemberships(
  userId: string,
): Promise<MembershipRow[]> {
  return db
    .select({
      organizationId: organizationMembers.organizationId,
      role: organizationMembers.role,
    })
    .from(organizationMembers)
    .where(eq(organizationMembers.userId, userId))
}

export async function hasOtherOwners(
  organizationId: string,
  excludingUserId: string,
): Promise<boolean> {
  const rows = await db
    .select({ id: organizationMembers.id })
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.role, "owner"),
        ne(organizationMembers.userId, excludingUserId),
      ),
    )
    .limit(1)
  return rows.length > 0
}

export async function deleteOrganization(
  organizationId: string,
): Promise<void> {
  await db.delete(organizations).where(eq(organizations.id, organizationId))
}

export interface MemberResult {
  id: string
  name: string
  email: string
  role: string
  joinedAt: string
}

export async function listMembersForOrganization(
  organizationId: string,
): Promise<MemberResult[]> {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: organizationMembers.role,
      joinedAt: organizationMembers.joinedAt,
    })
    .from(organizationMembers)
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(eq(organizationMembers.organizationId, organizationId))

  return rows.map((r) => ({
    ...r,
    joinedAt: r.joinedAt.toISOString(),
  }))
}
