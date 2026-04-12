import { randomBytes, randomUUID } from "node:crypto"
import { UnauthorizedException } from "@nestjs/common"
import { CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import * as bcrypt from "bcrypt"
import { UserRepository } from "../user.repository"
import { RefreshTokenRepository } from "../refresh-token.repository"
import { OrganizationRepository } from "../../organizations/organization.repository"

export class LoginCommand {
  constructor(
    public readonly email: string,
    public readonly password: string
  ) {}
}

export interface LoginResult {
  user: { id: string; email: string; name: string }
  accessToken: { sub: string; email: string; organizationId: string }
  refreshToken: string
}

@CommandHandler(LoginCommand)
export class LoginHandler implements ICommandHandler<LoginCommand> {
  constructor(
    private readonly userRepo: UserRepository,
    private readonly tokenRepo: RefreshTokenRepository,
    private readonly orgRepo: OrganizationRepository
  ) {}

  async execute(command: LoginCommand): Promise<LoginResult> {
    const user = await this.userRepo.findByEmail(
      command.email.toLowerCase().trim()
    )
    if (!user) throw new UnauthorizedException("Invalid email or password")

    const valid = await bcrypt.compare(command.password, user.passwordHash)
    if (!valid) throw new UnauthorizedException("Invalid email or password")

    const org = await this.orgRepo.findByUserId(user.id)
    if (!org) throw new UnauthorizedException("Invalid email or password")

    const rawToken = randomBytes(48).toString("base64url")
    const tokenHash = await bcrypt.hash(rawToken, 12)
    const familyId = randomUUID()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    await this.tokenRepo.insert({
      userId: user.id,
      tokenHash,
      familyId,
      expiresAt,
    })

    return {
      user: { id: user.id, email: user.email, name: user.name },
      accessToken: { sub: user.id, email: user.email, organizationId: org.id },
      refreshToken: rawToken,
    }
  }
}
