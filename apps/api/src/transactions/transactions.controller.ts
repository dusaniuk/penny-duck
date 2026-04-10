import { Controller, UseGuards } from "@nestjs/common"
import { CommandBus, QueryBus } from "@nestjs/cqrs"
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest"
import { transactionContract } from "@workspace/api-contract"
import { AuthGuard } from "../auth/presentation/auth.guard"
import { CurrentUser } from "../auth/presentation/auth.decorator"
import { type AccessTokenPayload } from "../auth/infrastructure/services/jwt.service"
import { CreateTransactionCommand } from "./commands/create-transaction.command"
import { UpdateTransactionCommand } from "./commands/update-transaction.command"
import { DeleteTransactionCommand } from "./commands/delete-transaction.command"
import { SettleTransactionCommand } from "./commands/settle-transaction.command"
import { CreateTransferCommand } from "./commands/create-transfer.command"
import { UpdateTransferCommand } from "./commands/update-transfer.command"
import { DeleteTransferCommand } from "./commands/delete-transfer.command"
import { GetTransactionQuery } from "./queries/get-transaction.query"
import { ListTransactionsQuery } from "./queries/list-transactions.query"

@Controller()
@UseGuards(AuthGuard)
export class TransactionsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus
  ) {}

  @TsRestHandler(transactionContract.create)
  handleCreate(@CurrentUser() user: AccessTokenPayload) {
    return tsRestHandler(transactionContract.create, async ({ body }) => {
      const transaction = await this.commandBus.execute(
        new CreateTransactionCommand({
          userId: user.sub,
          accountId: body.accountId,
          type: body.type,
          amount: body.amount,
          categoryId: body.categoryId,
          date: new Date(body.date),
          note: body.note,
          myShare: body.myShare,
          originalAmount: body.originalAmount,
          originalCurrency: body.originalCurrency,
          exchangeRate: body.exchangeRate,
        })
      )
      return { status: 201 as const, body: transaction }
    })
  }

  @TsRestHandler(transactionContract.list)
  handleList(@CurrentUser() user: AccessTokenPayload) {
    return tsRestHandler(transactionContract.list, async ({ query }) => {
      const page = query.page ?? 1
      const limit = query.limit ?? 50
      const { data, total } = await this.queryBus.execute(
        new ListTransactionsQuery(user.sub, {
          page,
          limit,
          accountId: query.accountId,
          type: query.type,
          categoryId: query.categoryId,
          settled: query.settled,
          transfer: query.transfer,
          dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
          dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
        })
      )
      return {
        status: 200 as const,
        body: { data, total, page, limit },
      }
    })
  }

  @TsRestHandler(transactionContract.get)
  handleGet(@CurrentUser() user: AccessTokenPayload) {
    return tsRestHandler(transactionContract.get, async ({ params }) => {
      const transaction = await this.queryBus.execute(
        new GetTransactionQuery(params.id, user.sub)
      )
      return { status: 200 as const, body: transaction }
    })
  }

  @TsRestHandler(transactionContract.update)
  handleUpdate(@CurrentUser() user: AccessTokenPayload) {
    return tsRestHandler(
      transactionContract.update,
      async ({ params, body }) => {
        const transaction = await this.commandBus.execute(
          new UpdateTransactionCommand(params.id, user.sub, {
            accountId: body.accountId,
            amount: body.amount,
            categoryId: body.categoryId,
            note: body.note,
            date: body.date ? new Date(body.date) : undefined,
            myShare: body.myShare,
            originalAmount: body.originalAmount,
            originalCurrency: body.originalCurrency,
            exchangeRate: body.exchangeRate,
          })
        )
        return { status: 200 as const, body: transaction }
      }
    )
  }

  @TsRestHandler(transactionContract.delete)
  handleDelete(@CurrentUser() user: AccessTokenPayload) {
    return tsRestHandler(transactionContract.delete, async ({ params }) => {
      await this.commandBus.execute(
        new DeleteTransactionCommand(params.id, user.sub)
      )
      return {
        status: 200 as const,
        body: { message: "Transaction deleted" },
      }
    })
  }

  @TsRestHandler(transactionContract.settle)
  handleSettle(@CurrentUser() user: AccessTokenPayload) {
    return tsRestHandler(transactionContract.settle, async ({ params }) => {
      const transaction = await this.commandBus.execute(
        new SettleTransactionCommand(params.id, user.sub)
      )
      return { status: 200 as const, body: transaction }
    })
  }

  @TsRestHandler(transactionContract.createTransfer)
  handleCreateTransfer(@CurrentUser() user: AccessTokenPayload) {
    return tsRestHandler(
      transactionContract.createTransfer,
      async ({ body }) => {
        const [outgoing, incoming] = await this.commandBus.execute(
          new CreateTransferCommand({
            userId: user.sub,
            fromAccountId: body.fromAccountId,
            toAccountId: body.toAccountId,
            amount: body.amount,
            date: new Date(body.date),
            note: body.note,
            originalAmount: body.originalAmount,
            originalCurrency: body.originalCurrency,
            exchangeRate: body.exchangeRate,
          })
        )
        return {
          status: 201 as const,
          body: { outgoing, incoming },
        }
      }
    )
  }

  @TsRestHandler(transactionContract.updateTransfer)
  handleUpdateTransfer(@CurrentUser() user: AccessTokenPayload) {
    return tsRestHandler(
      transactionContract.updateTransfer,
      async ({ params, body }) => {
        const [outgoing, incoming] = await this.commandBus.execute(
          new UpdateTransferCommand(params.transferId, user.sub, {
            amount: body.amount,
            date: body.date ? new Date(body.date) : undefined,
            note: body.note,
            originalAmount: body.originalAmount,
            originalCurrency: body.originalCurrency,
            exchangeRate: body.exchangeRate,
          })
        )
        return {
          status: 200 as const,
          body: { outgoing, incoming },
        }
      }
    )
  }

  @TsRestHandler(transactionContract.deleteTransfer)
  handleDeleteTransfer(@CurrentUser() user: AccessTokenPayload) {
    return tsRestHandler(
      transactionContract.deleteTransfer,
      async ({ params }) => {
        await this.commandBus.execute(
          new DeleteTransferCommand(params.transferId, user.sub)
        )
        return {
          status: 200 as const,
          body: { message: "Transfer deleted" },
        }
      }
    )
  }
}
