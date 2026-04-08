import { CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import {
  AccountNotFoundError,
  AccountHasTransactionsError,
} from "../domain/errors/account.errors"
import { AccountRepository } from "../domain/repositories/account.repository"
import { TransactionRepository } from "../../transactions/domain/repositories/transaction.repository"

export class DeleteAccountCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string
  ) {}
}

@CommandHandler(DeleteAccountCommand)
export class DeleteAccountHandler
  implements ICommandHandler<DeleteAccountCommand>
{
  constructor(
    private readonly accountRepo: AccountRepository,
    private readonly transactionRepo: TransactionRepository
  ) {}

  async execute(command: DeleteAccountCommand): Promise<void> {
    const { id, userId } = command

    const account = await this.accountRepo.findById(id, userId)
    if (!account) throw new AccountNotFoundError()

    const count = await this.transactionRepo.countByAccountId(id)
    if (count > 0) throw new AccountHasTransactionsError(count)

    await this.accountRepo.delete(id, userId)
  }
}
