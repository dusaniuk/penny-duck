import { Command, CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import { AccountRepository } from "../account.repository"

export class ClearDefaultAccountCommand extends Command<void> {
  constructor(
    public readonly userId: string,
    public readonly organizationId: string,
  ) {
    super()
  }
}

@CommandHandler(ClearDefaultAccountCommand)
export class ClearDefaultAccountHandler
  implements ICommandHandler<ClearDefaultAccountCommand>
{
  constructor(private readonly accountRepo: AccountRepository) {}

  async execute(cmd: ClearDefaultAccountCommand): Promise<void> {
    await this.accountRepo.clearDefault(cmd.userId, cmd.organizationId)
  }
}
