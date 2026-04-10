import { Module } from "@nestjs/common"
import { CqrsModule } from "@nestjs/cqrs"
import { DatabaseModule } from "@/database/database.module"
import { AuthModule } from "@/auth/auth.module"
import { CreateTransactionHandler } from "./commands/create-transaction.command"
import { UpdateTransactionHandler } from "./commands/update-transaction.command"
import { DeleteTransactionHandler } from "./commands/delete-transaction.command"
import { SettleTransactionHandler } from "./commands/settle-transaction.command"
import { CreateReimbursementHandler } from "./commands/create-reimbursement.command"
import { DeleteReimbursementHandler } from "./commands/delete-reimbursement.command"
import { CreateTransferHandler } from "./commands/create-transfer.command"
import { UpdateTransferHandler } from "./commands/update-transfer.command"
import { DeleteTransferHandler } from "./commands/delete-transfer.command"
import { GetTransactionHandler } from "./queries/get-transaction.query"
import { ListTransactionsHandler } from "./queries/list-transactions.query"
import { AccountRepository } from "@/accounts/account.repository"
import { TransactionRepository } from "./transaction.repository"
import { TransactionsController } from "./transactions.controller"

const commandHandlers = [
  CreateTransactionHandler,
  UpdateTransactionHandler,
  DeleteTransactionHandler,
  SettleTransactionHandler,
  CreateReimbursementHandler,
  DeleteReimbursementHandler,
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
    TransactionRepository,
    AccountRepository,
  ],
  exports: [TransactionRepository],
})
export class TransactionsModule {}
