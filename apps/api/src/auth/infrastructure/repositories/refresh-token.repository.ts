import { Inject, Injectable } from "@nestjs/common"
import { eq, and, gt, lt } from "drizzle-orm"
import { type DbClient, refreshTokens } from "@workspace/db"
import { DB_CLIENT } from "@/database/database.module"
import { RefreshToken } from "../../domain/entities/refresh-token.entity"

@Injectable()
export class RefreshTokenRepository {
  constructor(@Inject(DB_CLIENT) private readonly db: DbClient) {}

  async save(token: RefreshToken): Promise<RefreshToken> {
    if (token.id === "") {
      const rows = await this.db
        .insert(refreshTokens)
        .values({
          userId: token.userId,
          tokenHash: token.tokenHash,
          familyId: token.familyId,
          revoked: token.revoked,
          expiresAt: token.expiresAt,
        })
        .returning()

      return RefreshToken.fromPersistence(rows[0])
    }

    const rows = await this.db
      .update(refreshTokens)
      .set({ revoked: token.revoked })
      .where(eq(refreshTokens.id, token.id))
      .returning()

    return RefreshToken.fromPersistence(rows[0])
  }

  async findNonExpiredByFamilyId(familyId: string): Promise<RefreshToken[]> {
    const rows = await this.db
      .select()
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.familyId, familyId),
          gt(refreshTokens.expiresAt, new Date())
        )
      )

    return rows.map(RefreshToken.fromPersistence)
  }

  async revokeAllByFamilyId(familyId: string): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revoked: true })
      .where(eq(refreshTokens.familyId, familyId))
  }

  async findAllNonExpired(): Promise<RefreshToken[]> {
    const rows = await this.db
      .select()
      .from(refreshTokens)
      .where(gt(refreshTokens.expiresAt, new Date()))

    return rows.map(RefreshToken.fromPersistence)
  }

  async atomicRotate(
    tokenId: string,
    newTokenData: {
      userId: string
      tokenHash: string
      familyId: string
      expiresAt: Date
    },
  ): Promise<
    | { rotated: true; newRow: typeof refreshTokens.$inferSelect }
    | { rotated: false }
  > {
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

  async revokeAllByUserId(userId: string): Promise<void> {
    await this.db
      .update(refreshTokens)
      .set({ revoked: true })
      .where(eq(refreshTokens.userId, userId))
  }

  async deleteExpired(): Promise<number> {
    const rows = await this.db
      .delete(refreshTokens)
      .where(lt(refreshTokens.expiresAt, new Date()))
      .returning({ id: refreshTokens.id })

    return rows.length
  }
}
