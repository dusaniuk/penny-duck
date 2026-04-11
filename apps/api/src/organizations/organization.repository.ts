import { Inject, Injectable } from "@nestjs/common"
import { eq } from "drizzle-orm"
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
}
