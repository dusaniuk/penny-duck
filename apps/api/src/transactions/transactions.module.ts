import { Module } from "@nestjs/common"
import { CqrsModule } from "@nestjs/cqrs"
import { DatabaseModule } from "@/database/database.module"
import { AuthModule } from "@/auth/auth.module"
import { CreateTransactionHandler } from "./application/commands/create-transaction.command"
import { UpdateTransactionHandler } from "./application/commands/update-transaction.command"
import { DeleteTransactionHandler } from "./application/commands/delete-transaction.command"
import { SettleTransactionHandler } from "./application/commands/settle-transaction.command"
import { CreateTransferHandler } from "./application/commands/create-transfer.command"
import { UpdateTransferHandler } from "./application/commands/update-transfer.command"
import { DeleteTransferHandler } from "./application/commands/delete-transfer.command"
import { GetTransactionHandler } from "./application/queries/get-transaction.query"
import { ListTransactionsHandler } from "./application/queries/list-transactions.query"
import { TransactionRepository } from "./domain/repositories/transaction.repository"
import { TransactionRepositoryImpl } from "./infrastructure/repositories/transaction.repository"
import { TransactionsController } from "./presentation/transactions.controller"
import { TransactionsExceptionFilter } from "./presentation/transactions-exception.filter"

const commandHandlers = [
  CreateTransactionHandler,
  UpdateTransactionHandler,
  DeleteTransactionHandler,
  SettleTransactionHandler,
  CreateTransferHandler,
  UpdateTransferHandler,
  DeleteTransferHandler,
]
const queryHandlers = [GetTransactionHandler, ListTransactionsHandler]

@Module({
  imports: [DatabaseModule, CqrsModule, AuthModule],
  controllers: [TransactionsController],
  providers: [
    ...commandHandlers,
    ...queryHandlers,
    { provide: TransactionRepository, useClass: TransactionRepositoryImpl },
    TransactionsExceptionFilter,
  ],
  exports: [TransactionRepository],
})
export class TransactionsModule {}
