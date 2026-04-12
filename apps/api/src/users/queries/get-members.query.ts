import { Inject } from "@nestjs/common"
import { IQueryHandler, QueryHandler } from "@nestjs/cqrs"
import { eq } from "drizzle-orm"
import { type DbClient, organizationMembers, users } from "@workspace/db"
import { DB_CLIENT } from "@/database/database.module"

export class GetMembersQuery {
  constructor(public readonly organizationId: string) {}
}

export interface MemberResult {
  id: string
  name: string
  email: string
  role: string
  joinedAt: string
}

@QueryHandler(GetMembersQuery)
export class GetMembersHandler implements IQueryHandler<GetMembersQuery> {
  constructor(@Inject(DB_CLIENT) private readonly db: DbClient) {}

  async execute(query: GetMembersQuery): Promise<MemberResult[]> {
    const rows = await this.db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        role: organizationMembers.role,
        joinedAt: organizationMembers.joinedAt,
      })
      .from(organizationMembers)
      .innerJoin(users, eq(users.id, organizationMembers.userId))
      .where(eq(organizationMembers.organizationId, query.organizationId))

    return rows.map((r) => ({
      ...r,
      joinedAt: r.joinedAt.toISOString(),
    }))
  }
}
