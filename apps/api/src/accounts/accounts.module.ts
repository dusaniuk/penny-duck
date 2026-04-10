import { forwardRef, Module } from "@nestjs/common"
import { CqrsModule } from "@nestjs/cqrs"
import { DatabaseModule } from "@/database/database.module"
import { AuthModule } from "@/auth/auth.module"
import { TransactionsModule } from "@/transactions/transactions.module"
import { CreateAccountHandler } from "./commands/create-account.command"
import { UpdateAccountHandler } from "./commands/update-account.command"
import { DeleteAccountHandler } from "./commands/delete-account.command"
import { GetAccountsHandler } from "./queries/get-accounts.query"
import { GetAccountHandler } from "./queries/get-account.query"
import { AccountRepository } from "./account.repository"
import { AccountsController } from "./accounts.controller"

const commandHandlers = [
  CreateAccountHandler,
  UpdateAccountHandler,
  DeleteAccountHandler,
]
const queryHandlers = [GetAccountsHandler, GetAccountHandler]

@Module({
  imports: [
    DatabaseModule,
    CqrsModule,
    AuthModule,
    forwardRef(() => TransactionsModule),
  ],
  controllers: [AccountsController],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    AccountRepository,
  ],
  exports: [AccountRepository],
})
export class AccountsModule {}
