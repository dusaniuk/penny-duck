import { UnauthorizedException } from "@nestjs/common"
import { CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import * as bcrypt from "bcrypt"
import { RefreshTokenRepository } from "../refresh-token.repository"

export class LogoutCommand {
  constructor(public readonly rawRefreshToken: string) {}
}

@CommandHandler(LogoutCommand)
export class LogoutHandler implements ICommandHandler<LogoutCommand> {
  constructor(private readonly tokenRepo: RefreshTokenRepository) {}

  async execute(command: LogoutCommand): Promise<void> {
    const allTokens = await this.tokenRepo.findAllNonExpired()

    let matchedFamilyId: string | null = null
    for (const token of allTokens) {
      if (await bcrypt.compare(command.rawRefreshToken, token.tokenHash)) {
        matchedFamilyId = token.familyId
        break
      }
    }

    if (!matchedFamilyId) throw new UnauthorizedException("Invalid token")

    await this.tokenRepo.revokeAllByFamilyId(matchedFamilyId)
  }
}
