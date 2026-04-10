import { CommandHandler, EventBus, ICommandHandler } from "@nestjs/cqrs"
import { User } from "../../domain/entities/user.entity"
import { UserRegisteredEvent } from "../../domain/events/user-registered.event"
import { UserRepository } from "../../infrastructure/repositories/user.repository"

export class SignupCommand {
  constructor(
    public readonly name: string,
    public readonly email: string,
    public readonly password: string
  ) {}
}

export interface SignupResult {
  message: string
}

@CommandHandler(SignupCommand)
export class SignupHandler implements ICommandHandler<SignupCommand> {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly eventBus: EventBus
  ) {}

  async execute(command: SignupCommand): Promise<SignupResult> {
    const existing = await this.userRepo.findByEmail(
      command.email.toLowerCase().trim()
    )
    if (existing) return { message: "Account created successfully" }

    const user = await User.register(
      command.name,
      command.email,
      command.password
    )
    const savedUser = await this.userRepo.save(user)

    this.eventBus.publish(
      new UserRegisteredEvent(savedUser.id, savedUser.email)
    )

    return { message: "Account created successfully" }
  }
}
