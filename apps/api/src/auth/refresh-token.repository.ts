import { Inject, Injectable } from "@nestjs/common"
import { eq, gt, lt } from "drizzle-orm"
import { type DbClient, refreshTokens } from "@workspace/db"
import { DB_CLIENT } from "@/database/database.module"

export type RefreshTokenRow = typeof refreshTokens.$inferSelect

@Injectable()
export class RefreshTokenRepository {
  constructor(@Inject(DB_CLIENT) private readonly db: DbClient) {}

  async insert(data: {
    userId: string
    tokenHash: string
    familyId: string
    expiresAt: Date
  }): Promise<RefreshTokenRow> {
    const [row] = await this.db
      .insert(refreshTokens)
      .values({ ...data, revoked: false })
      .returning()
    return row
  }

  async findAllNonExpired(): Promise<RefreshTokenRow[]> {
    return this.db
      .select()
      .from(refreshTokens)
      .where(gt(refreshTokens.expiresAt, new Date()))
  }

  async revokeAllByFamilyId(familyId: string): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revoked: true })
      .where(eq(refreshTokens.familyId, familyId))
  }

  async revokeAllByUserId(userId: string): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revoked: true })
      .where(eq(refreshTokens.userId, userId))
  }

  async atomicRotate(
    tokenId: string,
    newTokenData: {
      userId: string
      tokenHash: string
      familyId: string
      expiresAt: Date
    }
  ): Promise<{ rotated: true; newRow: RefreshTokenRow } | { rotated: false }> {
    return this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.id, tokenId))
        .for("update")

      if (!existing || existing.revoked) {
        return { rotated: false }
      }

      await tx
        .update(refreshTokens)
        .set({ revoked: true })
        .where(eq(refreshTokens.id, tokenId))

      const [newRow] = await tx
        .insert(refreshTokens)
        .values({
          userId: newTokenData.userId,
          tokenHash: newTokenData.tokenHash,
          familyId: newTokenData.familyId,
          revoked: false,
          expiresAt: newTokenData.expiresAt,
        })
        .returning()

      return { rotated: true, newRow }
    })
  }

  async deleteExpired(): Promise<number> {
    const rows = await this.db
      .delete(refreshTokens)
      .where(lt(refreshTokens.expiresAt, new Date()))
      .returning({ id: refreshTokens.id })

    return rows.length
  }
}
