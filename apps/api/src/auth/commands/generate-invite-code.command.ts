import { ForbiddenException } from "@nestjs/common"
import { CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import { env } from "@workspace/env/api"
import { NotOrgOwnerError, generateInviteCode } from "../core/auth"
import { OrganizationRepository } from "../../organizations/organization.repository"

export class GenerateInviteCodeCommand {
  constructor(
    public readonly userId: string,
    public readonly organizationId: string
  ) {}
}

export interface GenerateInviteCodeResult {
  inviteCode: string
  inviteUrl: string
}

@CommandHandler(GenerateInviteCodeCommand)
export class GenerateInviteCodeHandler
  implements ICommandHandler<GenerateInviteCodeCommand>
{
  constructor(private readonly orgRepo: OrganizationRepository) {}

  async execute(
    command: GenerateInviteCodeCommand
  ): Promise<GenerateInviteCodeResult> {
    try {
      const inviteCode = await generateInviteCode(
        command.userId,
        command.organizationId,
        {
          getMemberRole: (orgId, userId) =>
            this.orgRepo.getMemberRole(orgId, userId),
          setInviteCode: (orgId) => this.orgRepo.setInviteCode(orgId),
        }
      )
      const inviteUrl = `${env.WEB_URL}/invite?code=${inviteCode}`
      return { inviteCode, inviteUrl }
    } catch (err) {
      if (err instanceof NotOrgOwnerError) {
        throw new ForbiddenException(err.message)
      }
      throw err
    }
  }
}
