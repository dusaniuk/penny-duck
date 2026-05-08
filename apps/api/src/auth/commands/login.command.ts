import { UnauthorizedException } from "@nestjs/common"
import { CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import { InvalidCredentialsError, login, type LoginResult } from "../core/auth"
import { UserRepository } from "../user.repository"
import { RefreshTokenRepository } from "../refresh-token.repository"
import { OrganizationRepository } from "../../organizations/organization.repository"

export class LoginCommand {
  constructor(
    public readonly email: string,
    public readonly password: string
  ) {}
}

export type { LoginResult }

@CommandHandler(LoginCommand)
export class LoginHandler implements ICommandHandler<LoginCommand> {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly tokenRepo: RefreshTokenRepository,
    private readonly orgRepo: OrganizationRepository
  ) {}

  async execute(command: LoginCommand): Promise<LoginResult> {
    try {
      return await login(command.email, command.password, {
        findUserByEmail: (email) => this.userRepo.findByEmail(email),
        findOrgByUserId: (userId) => this.orgRepo.findByUserId(userId),
        insertRefreshToken: async (data) => {
          await this.tokenRepo.insert(data)
        },
      })
    } catch (err) {
      if (err instanceof InvalidCredentialsError) {
        throw new UnauthorizedException(err.message)
      }
      throw err
    }
  }
}
