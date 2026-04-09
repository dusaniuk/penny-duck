import { Command, CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import {
  AccountNotFoundError,
  AccountHasTransactionsError,
} from "../errors/account.errors"
import { AccountRepository } from "../repositories/account.repository"
import { TransactionRepository } from "../../transactions/repositories/transaction.repository"

export class DeleteAccountCommand extends Command<void> {
  constructor(
    public readonly id: string,
    public readonly userId: string
  ) {
    super()
  }
}

@CommandHandler(DeleteAccountCommand)
export class DeleteAccountHandler
  implements ICommandHandler<DeleteAccountCommand>
{
  constructor(
    private readonly accountRepo: AccountRepository,
    private readonly transactionRepo: TransactionRepository
  ) {}

  async execute(cmd: DeleteAccountCommand): Promise<void> {
    const account = await this.accountRepo.findById(cmd.id, cmd.userId)
    if (!account) throw new AccountNotFoundError()

    const count = await this.transactionRepo.countByAccountId(cmd.id)
    if (count > 0) throw new AccountHasTransactionsError(count)

    await this.accountRepo.delete(cmd.id, cmd.userId)
  }
}
