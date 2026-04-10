import { CommandHandler, EventBus, ICommandHandler } from "@nestjs/cqrs"
import { RefreshToken } from "../../domain/entities/refresh-token.entity"
import {
  InvalidTokenError,
  TokenReuseDetectedError,
} from "../../domain/errors/auth.errors"
import { TokenReuseDetectedEvent } from "../../domain/events/token-reuse-detected.event"
import { TokensRefreshedEvent } from "../../domain/events/tokens-refreshed.event"
import { RefreshTokenRepository } from "../../infrastructure/repositories/refresh-token.repository"
import { UserRepository } from "../../infrastructure/repositories/user.repository"
import { TokenFamily } from "../../domain/value-objects/token-family.vo"

export class RefreshTokensCommand {
  constructor(public readonly rawRefreshToken: string) {}
}

export interface RefreshTokensResult {
  accessToken: { sub: string; email: string }
  refreshToken: string
}

@CommandHandler(RefreshTokensCommand)
export class RefreshTokensHandler implements ICommandHandler<RefreshTokensCommand> {
  constructor(
    private readonly tokenRepo: RefreshTokenRepository,
    private readonly userRepo: UserRepository,
    private readonly eventBus: EventBus,
  ) {}

  async execute(command: RefreshTokensCommand): Promise<RefreshTokensResult> {
    const allTokens = await this.tokenRepo.findAllNonExpired()

    let matchedToken: RefreshToken | null = null
    for (const token of allTokens) {
      const matches = await token.verifyToken(command.rawRefreshToken)
      if (matches) {
        matchedToken = token
        break
      }
    }

    if (!matchedToken) throw new InvalidTokenError()

    if (matchedToken.revoked) {
      await this.tokenRepo.revokeAllByFamilyId(matchedToken.familyId)
      this.eventBus.publish(
        new TokenReuseDetectedEvent(matchedToken.userId, matchedToken.familyId)
      )
      throw new TokenReuseDetectedError(matchedToken.familyId)
    }

    // Prepare new token before entering transaction (bcrypt stays outside the row lock)
    const family = TokenFamily.fromExisting(matchedToken.familyId)
    const { token: newToken, rawValue } = await RefreshToken.issue(
      matchedToken.userId,
      family,
      7
    )

    // Atomic: lock old row → re-check revoked → revoke old → insert new
    const result = await this.tokenRepo.atomicRotate(matchedToken.id, {
      userId: newToken.userId,
      tokenHash: newToken.tokenHash,
      familyId: newToken.familyId,
      expiresAt: newToken.expiresAt,
    })

    if (!result.rotated) {
      // Lost the race — another request already revoked this token
      await this.tokenRepo.revokeAllByFamilyId(matchedToken.familyId)
      this.eventBus.publish(
        new TokenReuseDetectedEvent(matchedToken.userId, matchedToken.familyId)
      )
      throw new TokenReuseDetectedError(matchedToken.familyId)
    }

    const user = await this.userRepo.findById(matchedToken.userId)
    if (!user) throw new InvalidTokenError()

    this.eventBus.publish(
      new TokensRefreshedEvent(matchedToken.userId, matchedToken.familyId)
    )

    return {
      accessToken: { sub: matchedToken.userId, email: user.email },
      refreshToken: rawValue,
    }
  }
}
