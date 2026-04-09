import { Inject, Injectable } from "@nestjs/common"
import { eq, and, asc } from "drizzle-orm"
import { type DbClient, accounts } from "@workspace/db"
import { DB_CLIENT } from "@/database/database.module"

export type AccountRow = typeof accounts.$inferSelect

@Injectable()
export class AccountRepository {
  constructor(@Inject(DB_CLIENT) private readonly db: DbClient) {}

  async findAllByUserId(userId: string): Promise<AccountRow[]> {
    return this.db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, userId))
      .orderBy(asc(accounts.name))
  }

  async findById(id: string, userId: string): Promise<AccountRow | null> {
    const rows = await this.db
      .select()
      .from(accounts)
      .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
      .limit(1)
    return rows[0] ?? null
  }

  async findByAccountId(id: string): Promise<AccountRow | null> {
    const rows = await this.db
      .select()
      .from(accounts)
      .where(eq(accounts.id, id))
      .limit(1)
    return rows[0] ?? null
  }

  async insert(data: {
    userId: string
    name: string
    type: string
    currency: string
    balance?: number
  }): Promise<AccountRow> {
    const [row] = await this.db
      .insert(accounts)
      .values({
        userId: data.userId,
        name: data.name,
        type: data.type,
        currency: data.currency,
        balance: data.balance ?? 0,
      })
      .returning()
    return row
  }

  async update(
    id: string,
    data: { name?: string; type?: string; balance?: number }
  ): Promise<AccountRow> {
    const [row] = await this.db
      .update(accounts)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(accounts.id, id))
      .returning()
    return row
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.db
      .delete(accounts)
      .where(and(eq(accounts.id, id), eq(accounts.userId, userId)))
  }
}
