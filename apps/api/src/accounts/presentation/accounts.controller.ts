import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseFilters,
  UseGuards,
} from "@nestjs/common"
import { CommandBus, QueryBus } from "@nestjs/cqrs"
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
import { CreateAccountDto } from "./dto/create-account.dto"
import { UpdateAccountDto } from "./dto/update-account.dto"

@Controller("accounts")
@UseGuards(AuthGuard)
@UseFilters(AccountsExceptionFilter)
export class AccountsController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus
  ) {}

  @Get()
  async list(@CurrentUser() user: AccessTokenPayload) {
    const accounts = await this.queryBus.execute(new GetAccountsQuery(user.sub))
    return accounts.map((a: Account) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      currency: a.currency,
      balance: a.balance,
    }))
  }

  @Post()
  async create(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: CreateAccountDto
  ) {
    const account = await this.commandBus.execute(
      new CreateAccountCommand(
        user.sub,
        dto.name,
        dto.type,
        dto.currency,
        dto.balance
      )
    )
    return {
      id: account.id,
      name: account.name,
      type: account.type,
      currency: account.currency,
      balance: account.balance,
    }
  }

  @Get(":id")
  async get(@CurrentUser() user: AccessTokenPayload, @Param("id") id: string) {
    const account = await this.queryBus.execute(
      new GetAccountQuery(id, user.sub)
    )
    return {
      id: account.id,
      name: account.name,
      type: account.type,
      currency: account.currency,
      balance: account.balance,
    }
  }

  @Patch(":id")
  async update(
    @CurrentUser() user: AccessTokenPayload,
    @Param("id") id: string,
    @Body() dto: UpdateAccountDto
  ) {
    const account = await this.commandBus.execute(
      new UpdateAccountCommand(id, user.sub, dto.name, dto.type)
    )
    return {
      id: account.id,
      name: account.name,
      type: account.type,
      currency: account.currency,
      balance: account.balance,
    }
  }

  @Delete(":id")
  async remove(
    @CurrentUser() user: AccessTokenPayload,
    @Param("id") id: string
  ) {
    await this.commandBus.execute(new DeleteAccountCommand(id, user.sub))
    return { message: "Account deleted" }
  }
}
