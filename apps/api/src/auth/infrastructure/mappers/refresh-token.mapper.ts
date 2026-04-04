import { RefreshToken } from "../../domain/entities/refresh-token.entity"

interface RefreshTokenRow {
  id: string
  userId: string
  tokenHash: string
  familyId: string
  revoked: boolean
  expiresAt: Date
  createdAt: Date
}

export class RefreshTokenMapper {
  static toDomain(row: RefreshTokenRow): RefreshToken {
    return RefreshToken.fromPersistence({
      id: row.id,
      userId: row.userId,
      tokenHash: row.tokenHash,
      familyId: row.familyId,
      revoked: row.revoked,
      expiresAt: row.expiresAt,
      createdAt: row.createdAt,
    })
  }
}
