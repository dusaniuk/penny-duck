import { CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import { RefreshToken } from "../../domain/entities/refresh-token.entity"
import { InvalidTokenError } from "../../domain/errors/auth.errors"
import { RefreshTokenRepository } from "../../domain/repositories/refresh-token.repository"

export class LogoutCommand {
  constructor(public readonly rawRefreshToken: string) {}
}

@CommandHandler(LogoutCommand)
export class LogoutHandler implements ICommandHandler<LogoutCommand> {
  constructor(private readonly tokenRepo: RefreshTokenRepository) {}

  async execute(command: LogoutCommand): Promise<void> {
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

    await this.tokenRepo.revokeAllByFamilyId(matchedToken.familyId)
  }
}
