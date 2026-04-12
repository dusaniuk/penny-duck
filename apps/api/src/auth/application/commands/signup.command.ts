import { CommandHandler, EventBus, ICommandHandler } from "@nestjs/cqrs"
import { User } from "../../domain/entities/user.entity"
import { UserRegisteredEvent } from "../../domain/events/user-registered.event"
import { UserRepository } from "../../infrastructure/repositories/user.repository"
import { OrganizationRepository } from "../../../organizations/organization.repository"

export class SignupCommand {
  constructor(
    public readonly name: string,
    public readonly email: string,
    public readonly password: string,
    public readonly inviteCode?: string
  ) {}
}

export interface SignupResult {
  message: string
}

@CommandHandler(SignupCommand)
export class SignupHandler implements ICommandHandler<SignupCommand> {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly orgRepo: OrganizationRepository,
    private readonly eventBus: EventBus
  ) {}

  async execute(command: SignupCommand): Promise<SignupResult> {
    const existing = await this.userRepo.findByEmail(
      command.email.toLowerCase().trim()
    )
    if (existing) return { message: "Account created successfully" }

    // If invite code provided, validate it
    let targetOrg: { id: string } | null = null
    if (command.inviteCode) {
      targetOrg = await this.orgRepo.findByInviteCode(command.inviteCode)
      if (!targetOrg) return { message: "Account created successfully" }
    }

    const user = await User.register(
      command.name,
      command.email,
      command.password
    )
    const savedUser = await this.userRepo.save(user)

    let orgId: string
    if (targetOrg) {
      await this.orgRepo.addMember(targetOrg.id, savedUser.id)
      orgId = targetOrg.id
    } else {
      const org = await this.orgRepo.createWithOwner(
        `${savedUser.name}'s Space`,
        savedUser.id
      )
      orgId = org.id
    }

    this.eventBus.publish(
      new UserRegisteredEvent(savedUser.id, savedUser.email, orgId)
    )

    return { message: "Account created successfully" }
  }
}
