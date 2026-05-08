import { Controller, Res, UseGuards } from "@nestjs/common"
import { CommandBus, QueryBus } from "@nestjs/cqrs"
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest"
import { Response } from "express"
import { userContract } from "@workspace/api-contract"
import { AuthGuard } from "@/auth/auth.guard"
import { CookieService } from "@/auth/cookie.service"
import { CurrentOrg, CurrentUser } from "@/auth/auth.decorator"
import type { AccessTokenPayload } from "@/auth/core/jwt"
import { GetCurrentUserQuery } from "./queries/get-current-user.query"
import { GetMembersQuery } from "./queries/get-members.query"
import { ExportUserDataQuery } from "./queries/export-user-data.query"
import { UpdateProfileCommand } from "./commands/update-profile.command"
import { DeleteUserAccountCommand } from "./commands/delete-account.command"

@Controller()
@UseGuards(AuthGuard)
export class UsersController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly cookieService: CookieService
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

  @TsRestHandler(userContract.deleteMe)
  handleDeleteMe(
    @CurrentUser() user: AccessTokenPayload,
    @Res({ passthrough: true }) res: Response
  ) {
    return tsRestHandler(userContract.deleteMe, async ({ body }) => {
      const result = await this.commandBus.execute(
        new DeleteUserAccountCommand(user.sub, body.email)
      )
      this.cookieService.clearTokens(res)
      return {
        status: 200 as const,
        body: result,
      }
    })
  }

  @TsRestHandler(userContract.exportData)
  handleExportData(
    @CurrentUser() user: AccessTokenPayload,
    @CurrentOrg() organizationId: string
  ) {
    return tsRestHandler(userContract.exportData, async () => {
      return {
        status: 200 as const,
        body: await this.queryBus.execute(
          new ExportUserDataQuery(user.sub, organizationId)
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
