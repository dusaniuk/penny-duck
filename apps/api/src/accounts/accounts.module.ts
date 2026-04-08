import { forwardRef, Module } from "@nestjs/common"
import { CqrsModule } from "@nestjs/cqrs"
import { DatabaseModule } from "@/database/database.module"
import { AuthModule } from "@/auth/auth.module"
import { TransactionsModule } from "@/transactions/transactions.module"
import { CreateAccountHandler } from "./application/create-account.command"
import { UpdateAccountHandler } from "./application/update-account.command"
import { DeleteAccountHandler } from "./application/delete-account.command"
import { GetAccountsHandler } from "./application/get-accounts.query"
import { GetAccountHandler } from "./application/get-account.query"
import { TransactionCreatedHandler } from "./application/event-handlers/transaction-created.handler"
import { TransactionDeletedHandler } from "./application/event-handlers/transaction-deleted.handler"
import { AccountRepository } from "./domain/repositories/account.repository"
import { AccountRepositoryImpl } from "./infrastructure/repositories/account.repository"
import { AccountsController } from "./presentation/accounts.controller"
import { AccountsExceptionFilter } from "./presentation/accounts-exception.filter"

const commandHandlers = [
  CreateAccountHandler,
  UpdateAccountHandler,
  DeleteAccountHandler,
]
const queryHandlers = [GetAccountsHandler, GetAccountHandler]
const eventHandlers = [TransactionCreatedHandler, TransactionDeletedHandler]

@Module({
  imports: [DatabaseModule, CqrsModule, AuthModule, forwardRef(() => TransactionsModule)],
  controllers: [AccountsController],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    ...eventHandlers,
    { provide: AccountRepository, useClass: AccountRepositoryImpl },
    AccountsExceptionFilter,
  ],
  exports: [AccountRepository],
})
export class AccountsModule {}
