import { ConflictException, NotFoundException } from "@nestjs/common"
import { Command, CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import { AccountRepository } from "../account.repository"
import { TransactionRepository } from "../../transactions/transaction.repository"

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
    if (!account) throw new NotFoundException("Account not found")

    const count = await this.transactionRepo.countByAccountId(cmd.id)
    if (count > 0)
      throw new ConflictException(
        `Account has ${count} transaction${count !== 1 ? "s" : ""} and cannot be deleted`
      )

    await this.accountRepo.delete(cmd.id, cmd.userId)
  }
}
