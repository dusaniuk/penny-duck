import { Controller, UseFilters, UseGuards } from "@nestjs/common"
import { CommandBus, QueryBus } from "@nestjs/cqrs"
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest"
import { accountContract } from "@workspace/api-contract"
import { AuthGuard } from "../../auth/presentation/auth.guard"
import { CurrentUser } from "../../auth/presentation/auth.decorator"
import { type AccessTokenPayload } from "../../auth/infrastructure/services/jwt.service"
import { CreateAccountCommand } from "../application/create-account.command"
import { UpdateAccountCommand } from "../application/update-account.command"
import { DeleteAccountCommand } from "../application/delete-account.command"
import { GetAccountsQuery } from "../application/get-accounts.query"
import { GetAccountQuery } from "../application/get-account.query"
import { AccountsExceptionFilter } from "./accounts-exception.filter"
import { Account } from "../domain/entities/account.entity"

@Controller()
@UseGuards(AuthGuard)
@UseFilters(AccountsExceptionFilter)
export class AccountsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus
  ) {}

  @TsRestHandler(accountContract.list)
  handleList(@CurrentUser() user: AccessTokenPayload) {
    return tsRestHandler(accountContract.list, async () => {
      const accounts = await this.queryBus.execute(
        new GetAccountsQuery(user.sub)
      )
      return {
        status: 200 as const,
        body: accounts.map((a: Account) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          currency: a.currency,
          balance: a.balance,
        })),
      }
    })
  }

  @TsRestHandler(accountContract.create)
  handleCreate(@CurrentUser() user: AccessTokenPayload) {
    return tsRestHandler(accountContract.create, async ({ body }) => {
      const account = await this.commandBus.execute(
        new CreateAccountCommand(
          user.sub,
          body.name,
          body.type,
          body.currency,
          body.balance
        )
      )
      return {
        status: 201 as const,
        body: {
          id: account.id,
          name: account.name,
          type: account.type,
          currency: account.currency,
          balance: account.balance,
        },
      }
    })
  }

  @TsRestHandler(accountContract.get)
  handleGet(@CurrentUser() user: AccessTokenPayload) {
    return tsRestHandler(accountContract.get, async ({ params }) => {
      const account = await this.queryBus.execute(
        new GetAccountQuery(params.id, user.sub)
      )
      return {
        status: 200 as const,
        body: {
          id: account.id,
          name: account.name,
          type: account.type,
          currency: account.currency,
          balance: account.balance,
        },
      }
    })
  }

  @TsRestHandler(accountContract.update)
  handleUpdate(@CurrentUser() user: AccessTokenPayload) {
    return tsRestHandler(accountContract.update, async ({ params, body }) => {
      const account = await this.commandBus.execute(
        new UpdateAccountCommand(params.id, user.sub, body.name, body.type)
      )
      return {
        status: 200 as const,
        body: {
          id: account.id,
          name: account.name,
          type: account.type,
          currency: account.currency,
          balance: account.balance,
        },
      }
    })
  }

  @TsRestHandler(accountContract.delete)
  handleDelete(@CurrentUser() user: AccessTokenPayload) {
    return tsRestHandler(accountContract.delete, async ({ params }) => {
      await this.commandBus.execute(
        new DeleteAccountCommand(params.id, user.sub)
      )
      return { status: 200 as const, body: { message: "Account deleted" } }
    })
  }
}
