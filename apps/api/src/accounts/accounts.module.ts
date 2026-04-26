import { forwardRef, Module } from "@nestjs/common"
import { CqrsModule } from "@nestjs/cqrs"
import { DatabaseModule } from "@/database/database.module"
import { AuthModule } from "@/auth/auth.module"
import { TransactionsModule } from "@/transactions/transactions.module"
import { ExchangeRatesModule } from "@/exchange-rates/exchange-rates.module"
import { UserRepository } from "@/users/user.repository"
import { TradeRepository } from "@/investments/trade.repository"
import { CreateAccountHandler } from "./commands/create-account.command"
import { UpdateAccountHandler } from "./commands/update-account.command"
import { DeleteAccountHandler } from "./commands/delete-account.command"
import { SetDefaultAccountHandler } from "./commands/set-default-account.command"
import { ClearDefaultAccountHandler } from "./commands/clear-default-account.command"
import { GetAccountsHandler } from "./queries/get-accounts.query"
import { GetAccountHandler } from "./queries/get-account.query"
import { AccountRepository } from "./account.repository"
import { AccountsController } from "./accounts.controller"

const commandHandlers = [
  CreateAccountHandler,
  UpdateAccountHandler,
  DeleteAccountHandler,
  SetDefaultAccountHandler,
  ClearDefaultAccountHandler,
]
const queryHandlers = [GetAccountsHandler, GetAccountHandler]

@Module({
  imports: [
    DatabaseModule,
    CqrsModule,
    AuthModule,
    forwardRef(() => TransactionsModule),
    ExchangeRatesModule,
  ],
  controllers: [AccountsController],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    AccountRepository,
    UserRepository,
    TradeRepository,
  ],
  exports: [AccountRepository],
})
export class AccountsModule {}
