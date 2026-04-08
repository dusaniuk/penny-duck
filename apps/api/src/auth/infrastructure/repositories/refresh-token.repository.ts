import { Inject, Injectable } from "@nestjs/common"
import { eq, and, gt, lt } from "drizzle-orm"
import { type DbClient, refreshTokens } from "@workspace/db"
import { DB_CLIENT } from "@/database/database.module"
import { RefreshToken } from "../../domain/entities/refresh-token.entity"
import { RefreshTokenRepository } from "../../domain/repositories/refresh-token.repository"
import { RefreshTokenMapper } from "../mappers/refresh-token.mapper"

@Injectable()
export class RefreshTokenRepositoryImpl extends RefreshTokenRepository {
  constructor(@Inject(DB_CLIENT) private readonly db: DbClient) {
    super()
  }

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

      return RefreshTokenMapper.toDomain(rows[0])
    }

    const rows = await this.db
      .update(refreshTokens)
      .set({ revoked: token.revoked })
      .where(eq(refreshTokens.id, token.id))
      .returning()

    return RefreshTokenMapper.toDomain(rows[0])
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

    return rows.map(RefreshTokenMapper.toDomain)
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

    return rows.map(RefreshTokenMapper.toDomain)
  }

  async deleteExpired(): Promise<number> {
    const rows = await this.db
      .delete(refreshTokens)
      .where(lt(refreshTokens.expiresAt, new Date()))
      .returning({ id: refreshTokens.id })

    return rows.length
  }
}
