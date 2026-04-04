import { CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import { AccountNotFoundError } from "../domain/errors/account.errors"
import { AccountRepository } from "../domain/repositories/account.repository"

export class DeleteAccountCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string
  ) {}
}

@CommandHandler(DeleteAccountCommand)
export class DeleteAccountHandler implements ICommandHandler<DeleteAccountCommand> {
  constructor(private readonly accountRepo: AccountRepository) {}

  async execute(command: DeleteAccountCommand): Promise<void> {
    const account = await this.accountRepo.findById(command.id, command.userId)
    if (!account) throw new AccountNotFoundError()

    await this.accountRepo.delete(command.id, command.userId)
  }
}
