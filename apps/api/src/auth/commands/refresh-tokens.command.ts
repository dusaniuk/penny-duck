import { UnauthorizedException } from "@nestjs/common"
import { CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import {
  InvalidRefreshTokenError,
  rotateRefreshToken,
  type RotateRefreshTokenResult,
} from "../core/auth"
import { RefreshTokenRepository } from "../refresh-token.repository"
import { UserRepository } from "../user.repository"
import { OrganizationRepository } from "../../organizations/organization.repository"

export class RefreshTokensCommand {
  constructor(public readonly rawRefreshToken: string) {}
}

export type RefreshTokensResult = RotateRefreshTokenResult

@CommandHandler(RefreshTokensCommand)
export class RefreshTokensHandler
  implements ICommandHandler<RefreshTokensCommand>
{
  constructor(
    private readonly tokenRepo: RefreshTokenRepository,
    private readonly userRepo: UserRepository,
    private readonly orgRepo: OrganizationRepository
  ) {}

  async execute(
    command: RefreshTokensCommand
  ): Promise<RefreshTokensResult> {
    try {
      return await rotateRefreshToken(command.rawRefreshToken, {
        findRefreshToken: (token) => this.tokenRepo.findByToken(token),
        deleteRefreshToken: (token) => this.tokenRepo.deleteByToken(token),
        insertRefreshToken: async (data) => {
          await this.tokenRepo.insert(data)
        },
        findUserById: (id) => this.userRepo.findById(id),
        findOrgByUserId: (userId) => this.orgRepo.findByUserId(userId),
      })
    } catch (err) {
      if (err instanceof InvalidRefreshTokenError) {
        throw new UnauthorizedException(err.message)
      }
      throw err
    }
  }
}
