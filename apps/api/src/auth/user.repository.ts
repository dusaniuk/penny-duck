import { Inject, Injectable } from "@nestjs/common"
import { eq } from "drizzle-orm"
import { type DbClient, users } from "@workspace/db"
import { DB_CLIENT } from "@/database/database.module"

export type UserRow = typeof users.$inferSelect

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

  async findByEmail(email: string): Promise<UserRow | null> {
    const rows = await this.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1)

    return rows[0] ?? null
  }

  async insert(data: {
    email: string
    name: string
    passwordHash: string
  }): Promise<UserRow> {
    const [row] = await this.db.insert(users).values(data).returning()
    return row
  }
}
