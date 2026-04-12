import { randomBytes } from "node:crypto"
import { UnauthorizedException } from "@nestjs/common"
import { CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import { RefreshTokenRepository } from "../refresh-token.repository"
import { UserRepository } from "../user.repository"
import { OrganizationRepository } from "../../organizations/organization.repository"

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
    private readonly orgRepo: OrganizationRepository
  ) {}

  async execute(
    command: RefreshTokensCommand
  ): Promise<RefreshTokensResult> {
    const existing = await this.tokenRepo.findByToken(
      command.rawRefreshToken
    )

    if (!existing || existing.expiresAt < new Date()) {
      throw new UnauthorizedException("Invalid token")
    }

    // Delete old token and issue new one
    await this.tokenRepo.deleteByToken(command.rawRefreshToken)

    const newToken = randomBytes(48).toString("base64url")
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    await this.tokenRepo.insert({
      userId: existing.userId,
      token: newToken,
      expiresAt,
    })

    const user = await this.userRepo.findById(existing.userId)
    if (!user) throw new UnauthorizedException("Invalid token")

    const org = await this.orgRepo.findByUserId(existing.userId)
    if (!org) throw new UnauthorizedException("Invalid token")

    return {
      accessToken: {
        sub: existing.userId,
        email: user.email,
        organizationId: org.id,
      },
      refreshToken: newToken,
    }
  }
}
