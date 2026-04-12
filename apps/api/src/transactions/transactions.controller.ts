import { Controller, UseGuards } from "@nestjs/common"
import { CommandBus, QueryBus } from "@nestjs/cqrs"
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest"
import { transactionContract } from "@workspace/api-contract"
import { AuthGuard } from "../auth/auth.guard"
import { CurrentUser, CurrentOrg } from "../auth/auth.decorator"
import { type AccessTokenPayload } from "../auth/jwt.service"
import { UserRepository } from "../auth/user.repository"
import { CreateTransactionCommand } from "./commands/create-transaction.command"
import { UpdateTransactionCommand } from "./commands/update-transaction.command"
import { DeleteTransactionCommand } from "./commands/delete-transaction.command"
import { SettleTransactionCommand } from "./commands/settle-transaction.command"
import { CreateReimbursementCommand } from "./commands/create-reimbursement.command"
import { DeleteReimbursementCommand } from "./commands/delete-reimbursement.command"
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
    private readonly queryBus: QueryBus,
    private readonly userRepo: UserRepository
  ) {}

  @TsRestHandler(transactionContract.create)
  handleCreate(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AccessTokenPayload
  ) {
    return tsRestHandler(transactionContract.create, async ({ body }) => {
      const transaction = await this.commandBus.execute(
        new CreateTransactionCommand({
          organizationId: organizationId,
          accountId: body.accountId,
          type: body.type,
          amount: body.amount,
          categoryId: body.categoryId,
          date: new Date(body.date),
          note: body.note,
          settled: body.settled,
          originalAmount: body.originalAmount,
          originalCurrency: body.originalCurrency,
          exchangeRate: body.exchangeRate,
          madeById: body.madeById ?? user.sub,
        })
      )
      return { status: 201 as const, body: transaction }
    })
  }

  @TsRestHandler(transactionContract.list)
  handleList(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AccessTokenPayload
  ) {
    return tsRestHandler(transactionContract.list, async ({ query }) => {
      const currentUser = await this.userRepo.findById(user.sub)
      const homeCurrency = currentUser?.homeCurrency ?? "UAH"

      const page = query.page ?? 1
      const limit = query.limit ?? 50
      const { data, total } = await this.queryBus.execute(
        new ListTransactionsQuery(organizationId, homeCurrency, {
          page,
          limit,
          accountId: query.accountId,
          type: query.type,
          categoryId: query.categoryId,
          settled: query.settled,
          transfer: query.transfer,
          dateFrom: query.dateFrom ? new Date(query.dateFrom) : undefined,
          dateTo: query.dateTo ? new Date(query.dateTo) : undefined,
          madeById: query.madeById,
        })
      )
      return {
        status: 200 as const,
        body: { data, total, page, limit },
      }
    })
  }

  @TsRestHandler(transactionContract.get)
  handleGet(@CurrentOrg() organizationId: string) {
    return tsRestHandler(transactionContract.get, async ({ params }) => {
      const transaction = await this.queryBus.execute(
        new GetTransactionQuery(params.id, organizationId)
      )
      return { status: 200 as const, body: transaction }
    })
  }

  @TsRestHandler(transactionContract.update)
  handleUpdate(@CurrentOrg() organizationId: string) {
    return tsRestHandler(
      transactionContract.update,
      async ({ params, body }) => {
        const transaction = await this.commandBus.execute(
          new UpdateTransactionCommand(params.id, organizationId, {
            accountId: body.accountId,
            amount: body.amount,
            categoryId: body.categoryId,
            note: body.note,
            date: body.date ? new Date(body.date) : undefined,
            originalAmount: body.originalAmount,
            originalCurrency: body.originalCurrency,
            exchangeRate: body.exchangeRate,
            madeById: body.madeById,
          })
        )
        return { status: 200 as const, body: transaction }
      }
    )
  }

  @TsRestHandler(transactionContract.delete)
  handleDelete(@CurrentOrg() organizationId: string) {
    return tsRestHandler(transactionContract.delete, async ({ params }) => {
      await this.commandBus.execute(
        new DeleteTransactionCommand(params.id, organizationId)
      )
      return {
        status: 200 as const,
        body: { message: "Transaction deleted" },
      }
    })
  }

  @TsRestHandler(transactionContract.settle)
  handleSettle(@CurrentOrg() organizationId: string) {
    return tsRestHandler(transactionContract.settle, async ({ params }) => {
      const transaction = await this.commandBus.execute(
        new SettleTransactionCommand(params.id, organizationId)
      )
      return { status: 200 as const, body: transaction }
    })
  }

  @TsRestHandler(transactionContract.createReimbursement)
  handleCreateReimbursement(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AccessTokenPayload
  ) {
    return tsRestHandler(
      transactionContract.createReimbursement,
      async ({ params, body }) => {
        const transaction = await this.commandBus.execute(
          new CreateReimbursementCommand({
            transactionId: params.id,
            organizationId: organizationId,
            accountId: body.accountId,
            amount: body.amount,
            date: new Date(body.date),
            exchangeRate: body.exchangeRate,
            madeById: body.madeById ?? user.sub,
          })
        )
        return { status: 201 as const, body: transaction }
      }
    )
  }

  @TsRestHandler(transactionContract.deleteReimbursement)
  handleDeleteReimbursement(@CurrentOrg() organizationId: string) {
    return tsRestHandler(
      transactionContract.deleteReimbursement,
      async ({ params }) => {
        await this.commandBus.execute(
          new DeleteReimbursementCommand(
            params.id,
            params.reimbursementTransactionId,
            organizationId
          )
        )
        return {
          status: 200 as const,
          body: { message: "Reimbursement deleted" },
        }
      }
    )
  }

  @TsRestHandler(transactionContract.createTransfer)
  handleCreateTransfer(
    @CurrentOrg() organizationId: string,
    @CurrentUser() user: AccessTokenPayload
  ) {
    return tsRestHandler(
      transactionContract.createTransfer,
      async ({ body }) => {
        const [outgoing, incoming] = await this.commandBus.execute(
          new CreateTransferCommand({
            organizationId: organizationId,
            fromAccountId: body.fromAccountId,
            toAccountId: body.toAccountId,
            amount: body.amount,
            date: new Date(body.date),
            note: body.note,
            originalAmount: body.originalAmount,
            originalCurrency: body.originalCurrency,
            exchangeRate: body.exchangeRate,
            madeById: body.madeById ?? user.sub,
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
  handleUpdateTransfer(@CurrentOrg() organizationId: string) {
    return tsRestHandler(
      transactionContract.updateTransfer,
      async ({ params, body }) => {
        const [outgoing, incoming] = await this.commandBus.execute(
          new UpdateTransferCommand(params.transferId, organizationId, {
            amount: body.amount,
            date: body.date ? new Date(body.date) : undefined,
            note: body.note,
            originalAmount: body.originalAmount,
            originalCurrency: body.originalCurrency,
            exchangeRate: body.exchangeRate,
            madeById: body.madeById,
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
  handleDeleteTransfer(@CurrentOrg() organizationId: string) {
    return tsRestHandler(
      transactionContract.deleteTransfer,
      async ({ params }) => {
        await this.commandBus.execute(
          new DeleteTransferCommand(params.transferId, organizationId)
        )
        return {
          status: 200 as const,
          body: { message: "Transfer deleted" },
        }
      }
    )
  }
}
