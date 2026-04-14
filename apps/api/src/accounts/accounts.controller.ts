import { Controller, UseGuards } from "@nestjs/common"
import { CommandBus, QueryBus } from "@nestjs/cqrs"
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest"
import { accountContract } from "@workspace/api-contract"
import { AuthGuard } from "../auth/auth.guard"
import { CurrentOrg, CurrentUser } from "../auth/auth.decorator"
import type { AccessTokenPayload } from "../auth/jwt.service"
import { CreateAccountCommand } from "./commands/create-account.command"
import { UpdateAccountCommand } from "./commands/update-account.command"
import { DeleteAccountCommand } from "./commands/delete-account.command"
import { GetAccountsQuery } from "./queries/get-accounts.query"
import { GetAccountQuery } from "./queries/get-account.query"

@Controller()
@UseGuards(AuthGuard)
export class AccountsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus
  ) {}

  @TsRestHandler(accountContract.list)
  handleList(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    return tsRestHandler(accountContract.list, async () => {
      const accounts = await this.queryBus.execute(
        new GetAccountsQuery(organizationId, user.sub)
      )
      return { status: 200 as const, body: accounts }
    })
  }

  @TsRestHandler(accountContract.create)
  handleCreate(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    return tsRestHandler(accountContract.create, async ({ body }) => {
      const account = await this.commandBus.execute(
        new CreateAccountCommand(
          organizationId,
          user.sub,
          body.name,
          body.type,
          body.currency,
          body.balance,
        )
      )
      return { status: 201 as const, body: account }
    })
  }

  @TsRestHandler(accountContract.get)
  handleGet(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    return tsRestHandler(accountContract.get, async ({ params }) => {
      const account = await this.queryBus.execute(
        new GetAccountQuery(params.id, organizationId, user.sub)
      )
      return { status: 200 as const, body: account }
    })
  }

  @TsRestHandler(accountContract.update)
  handleUpdate(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AccessTokenPayload,
  ) {
    return tsRestHandler(accountContract.update, async ({ params, body }) => {
      const account = await this.commandBus.execute(
        new UpdateAccountCommand(params.id, organizationId, user.sub, body.name, body.type)
      )
      return { status: 200 as const, body: account }
    })
  }

  @TsRestHandler(accountContract.delete)
  handleDelete(@CurrentOrg() organizationId: string) {
    return tsRestHandler(accountContract.delete, async ({ params }) => {
      await this.commandBus.execute(
        new DeleteAccountCommand(params.id, organizationId)
      )
      return { status: 200 as const, body: { message: "Account deleted" } }
    })
  }
}
