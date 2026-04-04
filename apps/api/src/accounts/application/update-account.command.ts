import { CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import { AccountNotFoundError } from "../domain/errors/account.errors"
import { AccountRepository } from "../domain/repositories/account.repository"

export class UpdateAccountCommand {
  constructor(
    public readonly id: string,
    public readonly userId: string,
    public readonly name?: string,
    public readonly type?: string
  ) {}
}

@CommandHandler(UpdateAccountCommand)
export class UpdateAccountHandler implements ICommandHandler<UpdateAccountCommand> {
  constructor(private readonly accountRepo: AccountRepository) {}

  async execute(command: UpdateAccountCommand): Promise<void> {
    const account = await this.accountRepo.findById(command.id, command.userId)
    if (!account) throw new AccountNotFoundError()

    if (command.name !== undefined) account.updateName(command.name)
    if (command.type !== undefined) account.updateType(command.type)

    await this.accountRepo.save(account)
  }
}
