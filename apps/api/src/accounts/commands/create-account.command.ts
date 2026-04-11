import { Command, CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import { type Account } from "@workspace/api-contract"
import { AccountRepository } from "../account.repository"

export class CreateAccountCommand extends Command<Account> {
  constructor(
    public readonly organizationId: string,
    public readonly name: string,
    public readonly type: string,
    public readonly currency: string,
    public readonly balance?: number
  ) {
    super()
  }
}

@CommandHandler(CreateAccountCommand)
export class CreateAccountHandler
  implements ICommandHandler<CreateAccountCommand>
{
  constructor(private readonly accountRepo: AccountRepository) {}

  async execute(cmd: CreateAccountCommand): Promise<Account> {
    const row = await this.accountRepo.insert({
      organizationId: cmd.organizationId,
      name: cmd.name,
      type: cmd.type,
      currency: cmd.currency,
      initialBalance: cmd.balance,
    })
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      currency: row.currency,
      balance: row.balance,
    }
  }
}
