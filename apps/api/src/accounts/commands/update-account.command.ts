import { NotFoundException } from "@nestjs/common"
import { Command, CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import { type Account } from "@workspace/api-contract"
import { AccountRepository } from "../account.repository"

export class UpdateAccountCommand extends Command<Account> {
  constructor(
    public readonly id: string,
    public readonly organizationId: string,
    public readonly name?: string,
    public readonly type?: string
  ) {
    super()
  }
}

@CommandHandler(UpdateAccountCommand)
export class UpdateAccountHandler
  implements ICommandHandler<UpdateAccountCommand>
{
  constructor(private readonly accountRepo: AccountRepository) {}

  async execute(cmd: UpdateAccountCommand): Promise<Account> {
    const existing = await this.accountRepo.findById(cmd.id, cmd.organizationId)
    if (!existing) throw new NotFoundException("Account not found")

    const row = await this.accountRepo.update(cmd.id, cmd.organizationId, {
      name: cmd.name,
      type: cmd.type,
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
