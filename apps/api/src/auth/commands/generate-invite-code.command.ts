import { ForbiddenException } from "@nestjs/common"
import { CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import { env } from "@workspace/env/api"
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
    const role = await this.orgRepo.getMemberRole(
      command.organizationId,
      command.userId
    )
    if (role !== "owner") {
      throw new ForbiddenException(
        "Only the organization owner can generate invite links"
      )
    }

    const inviteCode = await this.orgRepo.setInviteCode(command.organizationId)
    const inviteUrl = `${env.WEB_URL}/invite?code=${inviteCode}`

    return { inviteCode, inviteUrl }
  }
}
