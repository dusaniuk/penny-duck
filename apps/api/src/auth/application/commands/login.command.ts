import { CommandHandler, EventBus, ICommandHandler } from "@nestjs/cqrs"
import { RefreshToken } from "../../domain/entities/refresh-token.entity"
import { InvalidCredentialsError } from "../../domain/errors/auth.errors"
import { UserLoggedInEvent } from "../../domain/events/user-logged-in.event"
import { RefreshTokenRepository } from "../../infrastructure/repositories/refresh-token.repository"
import { UserRepository } from "../../infrastructure/repositories/user.repository"
import { TokenFamily } from "../../domain/value-objects/token-family.vo"

export class LoginCommand {
  constructor(
    public readonly email: string,
    public readonly password: string
  ) {}
}

export interface LoginResult {
  user: { id: string; email: string; name: string }
  accessToken: { sub: string; email: string }
  refreshToken: string
}

@CommandHandler(LoginCommand)
export class LoginHandler implements ICommandHandler<LoginCommand> {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly tokenRepo: RefreshTokenRepository,
    private readonly eventBus: EventBus
  ) {}

  async execute(command: LoginCommand): Promise<LoginResult> {
    const user = await this.userRepo.findByEmail(
      command.email.toLowerCase().trim()
    )
    if (!user) throw new InvalidCredentialsError()

    const valid = await user.verifyPassword(command.password)
    if (!valid) throw new InvalidCredentialsError()

    const family = TokenFamily.create()
    const { token, rawValue } = await RefreshToken.issue(user.id, family, 7)
    await this.tokenRepo.save(token)

    this.eventBus.publish(new UserLoggedInEvent(user.id, family.value))

    return {
      user: { id: user.id, email: user.email, name: user.name },
      accessToken: { sub: user.id, email: user.email },
      refreshToken: rawValue,
    }
  }
}
