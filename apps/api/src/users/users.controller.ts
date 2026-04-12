import { Controller, UseGuards } from "@nestjs/common"
import { CommandBus, QueryBus } from "@nestjs/cqrs"
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest"
import { userContract } from "@workspace/api-contract"
import { AuthGuard } from "@/auth/presentation/auth.guard"
import { CurrentOrg, CurrentUser } from "@/auth/presentation/auth.decorator"
import type { AccessTokenPayload } from "@/auth/infrastructure/services/jwt.service"
import { GetCurrentUserQuery } from "./queries/get-current-user.query"
import { GetMembersQuery } from "./queries/get-members.query"
import { UpdateProfileCommand } from "./commands/update-profile.command"

@Controller()
@UseGuards(AuthGuard)
export class UsersController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus
  ) {}

  @TsRestHandler(userContract.getMe)
  handleGetMe(@CurrentUser() user: AccessTokenPayload) {
    return tsRestHandler(userContract.getMe, async () => {
      return {
        status: 200 as const,
        body: await this.queryBus.execute(
          new GetCurrentUserQuery(user.sub)
        ),
      }
    })
  }

  @TsRestHandler(userContract.updateMe)
  handleUpdateMe(@CurrentUser() user: AccessTokenPayload) {
    return tsRestHandler(userContract.updateMe, async ({ body }) => {
      return {
        status: 200 as const,
        body: await this.commandBus.execute(
          new UpdateProfileCommand(user.sub, body.name, body.homeCurrency)
        ),
      }
    })
  }

  @TsRestHandler(userContract.getMembers)
  handleGetMembers(@CurrentOrg() organizationId: string) {
    return tsRestHandler(userContract.getMembers, async () => {
      return {
        status: 200 as const,
        body: await this.queryBus.execute(
          new GetMembersQuery(organizationId)
        ),
      }
    })
  }
}
