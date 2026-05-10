import { BadRequestException } from "@nestjs/common"
import { CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import { WeakPasswordError, signup } from "../core/auth"
import { UserRepository } from "../user.repository"
import { OrganizationRepository } from "../../organizations/organization.repository"
import { seedDefaultCategories } from "@/hono/modules/categories/service"

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

const GENERIC_SUCCESS: SignupResult = { message: "Account created successfully" }

@CommandHandler(SignupCommand)
export class SignupHandler implements ICommandHandler<SignupCommand> {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly orgRepo: OrganizationRepository
  ) {}

  async execute(command: SignupCommand): Promise<SignupResult> {
    let result
    try {
      result = await signup(
        {
          name: command.name,
          email: command.email,
          password: command.password,
          inviteCode: command.inviteCode,
        },
        {
          findUserByEmail: (email) => this.userRepo.findByEmail(email),
          findOrgByInviteCode: (code) => this.orgRepo.findByInviteCode(code),
          insertUser: (data) => this.userRepo.insert(data),
          addOrgMember: (orgId, userId) =>
            this.orgRepo.addMember(orgId, userId),
          createOrgWithOwner: (name, userId) =>
            this.orgRepo.createWithOwner(name, userId),
        }
      )
    } catch (err) {
      if (err instanceof WeakPasswordError) {
        throw new BadRequestException(err.message)
      }
      throw err
    }

    if (result) {
      await seedDefaultCategories(result.organizationId)
    }

    return GENERIC_SUCCESS
  }
}
