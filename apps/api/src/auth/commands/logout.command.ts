import { CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import { logout } from "../core/auth"
import { RefreshTokenRepository } from "../refresh-token.repository"

export class LogoutCommand {
  constructor(public readonly rawRefreshToken: string) {}
}

@CommandHandler(LogoutCommand)
export class LogoutHandler implements ICommandHandler<LogoutCommand> {
  constructor(private readonly tokenRepo: RefreshTokenRepository) {}

  execute(command: LogoutCommand): Promise<void> {
    return logout(command.rawRefreshToken, {
      deleteRefreshToken: (token) => this.tokenRepo.deleteByToken(token),
    })
  }
}
