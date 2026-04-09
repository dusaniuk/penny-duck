import { CommandHandler, EventBus, ICommandHandler } from "@nestjs/cqrs"
import { RefreshToken } from "../../domain/entities/refresh-token.entity"
import { User } from "../../domain/entities/user.entity"
import { EmailAlreadyExistsError } from "../../domain/errors/auth.errors"
import { UserRegisteredEvent } from "../../domain/events/user-registered.event"
import { RefreshTokenRepository } from "../../infrastructure/repositories/refresh-token.repository"
import { UserRepository } from "../../infrastructure/repositories/user.repository"
import { TokenFamily } from "../../domain/value-objects/token-family.vo"

export class SignupCommand {
  constructor(
    public readonly name: string,
    public readonly email: string,
    public readonly password: string
  ) {}
}

export interface SignupResult {
  user: User
  accessToken: { sub: string; email: string }
  refreshToken: string
}

@CommandHandler(SignupCommand)
export class SignupHandler implements ICommandHandler<SignupCommand> {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly tokenRepo: RefreshTokenRepository,
    private readonly eventBus: EventBus
  ) {}

  async execute(command: SignupCommand): Promise<SignupResult> {
    const existing = await this.userRepo.findByEmail(
      command.email.toLowerCase().trim()
    )
    if (existing) throw new EmailAlreadyExistsError()

    const user = await User.register(
      command.name,
      command.email,
      command.password
    )
    const savedUser = await this.userRepo.save(user)

    const family = TokenFamily.create()
    const { token, rawValue } = await RefreshToken.issue(
      savedUser.id,
      family,
      7
    )
    await this.tokenRepo.save(token)

    this.eventBus.publish(
      new UserRegisteredEvent(savedUser.id, savedUser.email)
    )

    return {
      user: savedUser,
      accessToken: { sub: savedUser.id, email: savedUser.email },
      refreshToken: rawValue,
    }
  }
}
