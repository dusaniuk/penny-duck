import { Inject, Injectable } from "@nestjs/common"
import { eq } from "drizzle-orm"
import { type DbClient, users } from "@workspace/db"
import { DB_CLIENT } from "@/database/database.module"

type UserRow = typeof users.$inferSelect

@Injectable()
export class UserRepository {
  constructor(@Inject(DB_CLIENT) private readonly db: DbClient) {}

  async findById(id: string): Promise<UserRow | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .limit(1)

    return rows[0] ?? null
  }

  async updateProfile(
    userId: string,
    data: { name?: string; homeCurrency?: string }
  ): Promise<UserRow | null> {
    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (data.name !== undefined) updates.name = data.name
    if (data.homeCurrency !== undefined) updates.homeCurrency = data.homeCurrency

    const rows = await this.db
      .update(users)
      .set(updates)
      .where(eq(users.id, userId))
      .returning()

    return rows[0] ?? null
  }
}
