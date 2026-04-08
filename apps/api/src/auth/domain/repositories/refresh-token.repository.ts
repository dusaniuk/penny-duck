import { RefreshToken } from "../entities/refresh-token.entity"

export abstract class RefreshTokenRepository {
  abstract save(token: RefreshToken): Promise<RefreshToken>
  abstract findNonExpiredByFamilyId(familyId: string): Promise<RefreshToken[]>
  abstract revokeAllByFamilyId(familyId: string): Promise<void>
  abstract findAllNonExpired(): Promise<RefreshToken[]>
  abstract deleteExpired(): Promise<number>
}
