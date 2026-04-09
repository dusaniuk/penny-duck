import { CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import { Account } from "../domain/entities/account.entity"
import { AccountRepository } from "../repositories/account.repository"

export class CreateAccountCommand {
  constructor(
    public readonly userId: string,
    public readonly name: string,
    public readonly type: string,
    public readonly currency: string,
    public readonly balance: number = 0
  ) {}
}

@CommandHandler(CreateAccountCommand)
export class CreateAccountHandler implements ICommandHandler<CreateAccountCommand> {
  constructor(private readonly accountRepo: AccountRepository) {}

  async execute(command: CreateAccountCommand): Promise<Account> {
    const account = Account.create(
      command.userId,
      command.name,
      command.type,
      command.currency,
      command.balance
    )
    return this.accountRepo.save(account)
  }
}
