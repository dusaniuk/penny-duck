import { Command, CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import { type Account } from "@workspace/api-contract"
import { createAccount } from "@/hono/modules/accounts/service"

export class CreateAccountCommand extends Command<Account> {
  constructor(
    public readonly organizationId: string,
    public readonly userId: string,
    public readonly name: string,
    public readonly type: string,
    public readonly currency: string,
    public readonly balance?: number,
  ) {
    super()
  }
}

@CommandHandler(CreateAccountCommand)
export class CreateAccountHandler
  implements ICommandHandler<CreateAccountCommand>
{
  async execute(cmd: CreateAccountCommand): Promise<Account> {
    return createAccount({
      organizationId: cmd.organizationId,
      userId: cmd.userId,
      name: cmd.name,
      type: cmd.type,
      currency: cmd.currency,
      balance: cmd.balance,
    })
  }
}
