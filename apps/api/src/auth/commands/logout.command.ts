import { CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import { RefreshTokenRepository } from "../refresh-token.repository"

export class LogoutCommand {
  constructor(public readonly rawRefreshToken: string) {}
}

@CommandHandler(LogoutCommand)
export class LogoutHandler implements ICommandHandler<LogoutCommand> {
  constructor(private readonly tokenRepo: RefreshTokenRepository) {}

  async execute(command: LogoutCommand): Promise<void> {
    await this.tokenRepo.deleteByToken(command.rawRefreshToken)
  }
}
