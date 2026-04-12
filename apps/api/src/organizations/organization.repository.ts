import { Inject, Injectable } from "@nestjs/common"
import { eq, and } from "drizzle-orm"
import { randomBytes } from "node:crypto"
import {
  type DbClient,
  organizations,
  organizationMembers,
} from "@workspace/db"
import { DB_CLIENT } from "@/database/database.module"

export type OrganizationRow = typeof organizations.$inferSelect
export type OrganizationMemberRow = typeof organizationMembers.$inferSelect

@Injectable()
export class OrganizationRepository {
  constructor(@Inject(DB_CLIENT) private readonly db: DbClient) {}

  async createWithOwner(
    name: string,
    userId: string
  ): Promise<OrganizationRow> {
    return this.db.transaction(async (tx) => {
      const [org] = await tx
        .insert(organizations)
        .values({ name })
        .returning()

      await tx.insert(organizationMembers).values({
        organizationId: org.id,
        userId,
        role: "owner",
      })

      return org
    })
  }

  async findByUserId(userId: string): Promise<OrganizationRow | null> {
    const rows = await this.db
      .select({ org: organizations })
      .from(organizationMembers)
      .innerJoin(
        organizations,
        eq(organizations.id, organizationMembers.organizationId)
      )
      .where(eq(organizationMembers.userId, userId))
      .limit(1)
    return rows[0]?.org ?? null
  }

  async findByInviteCode(code: string): Promise<OrganizationRow | null> {
    const rows = await this.db
      .select()
      .from(organizations)
      .where(eq(organizations.inviteCode, code))
      .limit(1)
    return rows[0] ?? null
  }

  async setInviteCode(organizationId: string): Promise<string> {
    const [org] = await this.db
      .select({ inviteCode: organizations.inviteCode })
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1)

    if (org?.inviteCode) return org.inviteCode

    const code = randomBytes(16).toString("base64url")
    await this.db
      .update(organizations)
      .set({ inviteCode: code })
      .where(eq(organizations.id, organizationId))
    return code
  }

  async addMember(organizationId: string, userId: string): Promise<void> {
    await this.db.insert(organizationMembers).values({
      organizationId,
      userId,
      role: "member",
    })
  }

  async getMemberRole(
    organizationId: string,
    userId: string
  ): Promise<string | null> {
    const rows = await this.db
      .select({ role: organizationMembers.role })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.userId, userId)
        )
      )
      .limit(1)
    return rows[0]?.role ?? null
  }
}
