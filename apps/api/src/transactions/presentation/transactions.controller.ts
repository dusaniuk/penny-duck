import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseFilters,
  UseGuards,
} from "@nestjs/common"
import { CommandBus, QueryBus } from "@nestjs/cqrs"
import { AuthGuard } from "../../auth/presentation/auth.guard"
import { CurrentUser } from "../../auth/presentation/auth.decorator"
import { type AccessTokenPayload } from "../../auth/infrastructure/services/jwt.service"
import { Transaction } from "../domain/entities/transaction.entity"
import { CreateTransactionCommand } from "../application/commands/create-transaction.command"
import { UpdateTransactionCommand } from "../application/commands/update-transaction.command"
import { DeleteTransactionCommand } from "../application/commands/delete-transaction.command"
import { SettleTransactionCommand } from "../application/commands/settle-transaction.command"
import { CreateTransferCommand } from "../application/commands/create-transfer.command"
import { UpdateTransferCommand } from "../application/commands/update-transfer.command"
import { DeleteTransferCommand } from "../application/commands/delete-transfer.command"
import { GetTransactionQuery } from "../application/queries/get-transaction.query"
import { ListTransactionsQuery } from "../application/queries/list-transactions.query"
import { TransactionsExceptionFilter } from "./transactions-exception.filter"
import { CreateTransactionDto } from "./dto/create-transaction.dto"
import { UpdateTransactionDto } from "./dto/update-transaction.dto"
import { CreateTransferDto } from "./dto/create-transfer.dto"
import { UpdateTransferDto } from "./dto/update-transfer.dto"
import { ListTransactionsDto } from "./dto/list-transactions.dto"

function toResponse(t: Transaction) {
  return {
    id: t.id,
    accountId: t.accountId,
    type: t.type,
    amount: t.amount,
    categoryId: t.categoryId,
    note: t.note,
    date: t.date,
    myShare: t.myShare,
    settled: t.settled,
    originalAmount: t.exchangeRate?.originalAmount ?? null,
    originalCurrency: t.exchangeRate?.originalCurrency ?? null,
    exchangeRate: t.exchangeRate?.rate ?? null,
    transferId: t.transferId,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  }
}

@Controller("transactions")
@UseGuards(AuthGuard)
@UseFilters(TransactionsExceptionFilter)
export class TransactionsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus
  ) {}

  @Post()
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateTransactionDto
  ) {
    const transaction = await this.commandBus.execute(
      new CreateTransactionCommand({
        userId: user.sub,
        accountId: dto.accountId,
        type: dto.type,
        amount: dto.amount,
        categoryId: dto.categoryId,
        date: new Date(dto.date),
        note: dto.note,
        myShare: dto.myShare,
        originalAmount: dto.originalAmount,
        originalCurrency: dto.originalCurrency,
        exchangeRate: dto.exchangeRate,
      })
    )
    return toResponse(transaction)
  }

  @Get()
  async list(
    @CurrentUser() user: AccessTokenPayload,
    @Query() dto: ListTransactionsDto
  ) {
    const { data, total } = await this.queryBus.execute(
      new ListTransactionsQuery(user.sub, {
        page: dto.page ?? 1,
        limit: dto.limit ?? 50,
        accountId: dto.accountId,
        type: dto.type,
        categoryId: dto.categoryId,
        settled: dto.settled,
        orphaned: dto.orphaned,
        dateFrom: dto.dateFrom ? new Date(dto.dateFrom) : undefined,
        dateTo: dto.dateTo ? new Date(dto.dateTo) : undefined,
      })
    )
    return {
      data: data.map(toResponse),
      total,
      page: dto.page ?? 1,
      limit: dto.limit ?? 50,
    }
  }

  @Get(":id")
  async get(
    @CurrentUser() user: AccessTokenPayload,
    @Param("id") id: string
  ) {
    const transaction = await this.queryBus.execute(
      new GetTransactionQuery(id, user.sub)
    )
    return toResponse(transaction)
  }

  @Patch(":id")
  async update(
    @CurrentUser() user: AccessTokenPayload,
    @Param("id") id: string,
    @Body() dto: UpdateTransactionDto
  ) {
    const transaction = await this.commandBus.execute(
      new UpdateTransactionCommand(id, user.sub, {
        accountId: dto.accountId,
        amount: dto.amount,
        categoryId: dto.categoryId,
        note: dto.note,
        date: dto.date ? new Date(dto.date) : undefined,
        myShare: dto.myShare,
        originalAmount: dto.originalAmount,
        originalCurrency: dto.originalCurrency,
        exchangeRate: dto.exchangeRate,
      })
    )
    return toResponse(transaction)
  }

  @Delete(":id")
  async remove(
    @CurrentUser() user: AccessTokenPayload,
    @Param("id") id: string
  ) {
    await this.commandBus.execute(new DeleteTransactionCommand(id, user.sub))
    return { message: "Transaction deleted" }
  }

  @Patch(":id/settle")
  async settle(
    @CurrentUser() user: AccessTokenPayload,
    @Param("id") id: string
  ) {
    const transaction = await this.commandBus.execute(
      new SettleTransactionCommand(id, user.sub)
    )
    return toResponse(transaction)
  }


  @Post("transfers")
  async createTransfer(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateTransferDto
  ) {
    const [outgoing, incoming] = await this.commandBus.execute(
      new CreateTransferCommand({
        userId: user.sub,
        fromAccountId: dto.fromAccountId,
        toAccountId: dto.toAccountId,
        amount: dto.amount,
        date: new Date(dto.date),
        note: dto.note,
        originalAmount: dto.originalAmount,
        originalCurrency: dto.originalCurrency,
        exchangeRate: dto.exchangeRate,
      })
    )
    return {
      outgoing: toResponse(outgoing),
      incoming: toResponse(incoming),
    }
  }

  @Patch("transfers/:transferId")
  async updateTransfer(
    @CurrentUser() user: AccessTokenPayload,
    @Param("transferId") transferId: string,
    @Body() dto: UpdateTransferDto
  ) {
    const [outgoing, incoming] = await this.commandBus.execute(
      new UpdateTransferCommand(transferId, user.sub, {
        amount: dto.amount,
        date: dto.date ? new Date(dto.date) : undefined,
        note: dto.note,
        originalAmount: dto.originalAmount,
        originalCurrency: dto.originalCurrency,
        exchangeRate: dto.exchangeRate,
      })
    )
    return {
      outgoing: toResponse(outgoing),
      incoming: toResponse(incoming),
    }
  }

  @Delete("transfers/:transferId")
  async removeTransfer(
    @CurrentUser() user: AccessTokenPayload,
    @Param("transferId") transferId: string
  ) {
    await this.commandBus.execute(
      new DeleteTransferCommand(transferId, user.sub)
    )
    return { message: "Transfer deleted" }
  }
}
