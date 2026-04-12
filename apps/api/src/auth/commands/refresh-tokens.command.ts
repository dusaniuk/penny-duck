import { randomBytes } from "node:crypto"
import { UnauthorizedException } from "@nestjs/common"
import { CommandHandler, EventBus, ICommandHandler } from "@nestjs/cqrs"
import * as bcrypt from "bcrypt"
import {
  RefreshTokenRepository,
  type RefreshTokenRow,
} from "../refresh-token.repository"
import { UserRepository } from "../user.repository"
import { OrganizationRepository } from "../../organizations/organization.repository"
import { TokenReuseDetectedEvent } from "../events/token-reuse-detected.event"

export class RefreshTokensCommand {
  constructor(public readonly rawRefreshToken: string) {}
}

export interface RefreshTokensResult {
  accessToken: { sub: string; email: string; organizationId: string }
  refreshToken: string
}

@CommandHandler(RefreshTokensCommand)
export class RefreshTokensHandler
  implements ICommandHandler<RefreshTokensCommand>
{
  constructor(
    private readonly tokenRepo: RefreshTokenRepository,
    private readonly userRepo: UserRepository,
    private readonly orgRepo: OrganizationRepository,
    private readonly eventBus: EventBus
  ) {}

  async execute(
    command: RefreshTokensCommand
  ): Promise<RefreshTokensResult> {
    const allTokens = await this.tokenRepo.findAllNonExpired()

    let matched: RefreshTokenRow | null = null
    for (const token of allTokens) {
      if (await bcrypt.compare(command.rawRefreshToken, token.tokenHash)) {
        matched = token
        break
      }
    }

    if (!matched) throw new UnauthorizedException("Invalid token")

    if (matched.revoked) {
      await this.tokenRepo.revokeAllByFamilyId(matched.familyId)
      this.eventBus.publish(
        new TokenReuseDetectedEvent(matched.userId, matched.familyId)
      )
      throw new UnauthorizedException("Session invalidated")
    }

    // Prepare new token before entering transaction (bcrypt stays outside the row lock)
    const rawToken = randomBytes(48).toString("base64url")
    const tokenHash = await bcrypt.hash(rawToken, 12)
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    // Atomic: lock old row -> re-check revoked -> revoke old -> insert new
    const result = await this.tokenRepo.atomicRotate(matched.id, {
      userId: matched.userId,
      tokenHash,
      familyId: matched.familyId,
      expiresAt,
    })

    if (!result.rotated) {
      await this.tokenRepo.revokeAllByFamilyId(matched.familyId)
      this.eventBus.publish(
        new TokenReuseDetectedEvent(matched.userId, matched.familyId)
      )
      throw new UnauthorizedException("Session invalidated")
    }

    const user = await this.userRepo.findById(matched.userId)
    if (!user) throw new UnauthorizedException("Invalid token")

    const org = await this.orgRepo.findByUserId(matched.userId)
    if (!org) throw new UnauthorizedException("Invalid token")

    return {
      accessToken: {
        sub: matched.userId,
        email: user.email,
        organizationId: org.id,
      },
      refreshToken: rawToken,
    }
  }
}
