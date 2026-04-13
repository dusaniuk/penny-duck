import { BadRequestException } from "@nestjs/common"
import { CommandHandler, EventBus, ICommandHandler } from "@nestjs/cqrs"
import * as bcrypt from "bcrypt"
import { UserRepository } from "../user.repository"
import { OrganizationRepository } from "../../organizations/organization.repository"
import { UserRegisteredEvent } from "../events/user-registered.event"

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

    let targetOrg: { id: string } | null = null
    if (command.inviteCode) {
      targetOrg = await this.orgRepo.findByInviteCode(command.inviteCode)
      if (!targetOrg) return { message: "Account created successfully" }
    }

    if (command.password.length < 8) {
      throw new BadRequestException("Password must be at least 8 characters")
    }
    if (command.password.length > 128) {
      throw new BadRequestException("Password must be at most 128 characters")
    }

    const passwordHash = await bcrypt.hash(command.password, 12)
    const user = await this.userRepo.insert({
      email: command.email.trim().toLowerCase(),
      name: command.name,
      passwordHash,
      agreedToTermsAt: new Date(),
    })

    let orgId: string
    if (targetOrg) {
      await this.orgRepo.addMember(targetOrg.id, user.id)
      orgId = targetOrg.id
    } else {
      const org = await this.orgRepo.createWithOwner(
        `${user.name}'s Space`,
        user.id
      )
      orgId = org.id
    }

    this.eventBus.publish(
      new UserRegisteredEvent(user.id, user.email, orgId)
    )

    return { message: "Account created successfully" }
  }
}
