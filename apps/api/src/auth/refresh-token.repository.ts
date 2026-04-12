import { Inject, Injectable } from "@nestjs/common"
import { eq, lt } from "drizzle-orm"
import { type DbClient, refreshTokens } from "@workspace/db"
import { DB_CLIENT } from "@/database/database.module"

export type RefreshTokenRow = typeof refreshTokens.$inferSelect

@Injectable()
export class RefreshTokenRepository {
  constructor(@Inject(DB_CLIENT) private readonly db: DbClient) {}

  async insert(data: {
    userId: string
    token: string
    expiresAt: Date
  }): Promise<RefreshTokenRow> {
    const [row] = await this.db
      .insert(refreshTokens)
      .values(data)
      .returning()
    return row
  }

  async findByToken(token: string): Promise<RefreshTokenRow | null> {
    const rows = await this.db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.token, token))
      .limit(1)
    return rows[0] ?? null
  }

  async deleteByToken(token: string): Promise<void> {
    await this.db
      .delete(refreshTokens)
      .where(eq(refreshTokens.token, token))
  }

  async deleteExpired(): Promise<number> {
    const rows = await this.db
      .delete(refreshTokens)
      .where(lt(refreshTokens.expiresAt, new Date()))
      .returning({ id: refreshTokens.id })
    return rows.length
  }
}
