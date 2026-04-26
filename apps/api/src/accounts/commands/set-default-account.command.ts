import { NotFoundException } from "@nestjs/common"
import { Command, CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import { type Account } from "@workspace/api-contract"
import { AccountRepository } from "../account.repository"
import { ExchangeRateService } from "@/exchange-rates/exchange-rate.service"
import { UserRepository } from "@/users/user.repository"

export class SetDefaultAccountCommand extends Command<Account> {
  constructor(
    public readonly userId: string,
    public readonly organizationId: string,
    public readonly accountId: string,
  ) {
    super()
  }
}

@CommandHandler(SetDefaultAccountCommand)
export class SetDefaultAccountHandler
  implements ICommandHandler<SetDefaultAccountCommand>
{
  constructor(
    private readonly accountRepo: AccountRepository,
    private readonly exchangeRateService: ExchangeRateService,
    private readonly userRepo: UserRepository,
  ) {}

  async execute(cmd: SetDefaultAccountCommand): Promise<Account> {
    const existing = await this.accountRepo.findById(
      cmd.accountId,
      cmd.organizationId,
      cmd.userId,
    )
    if (!existing) throw new NotFoundException("Account not found")

    await this.accountRepo.setDefault(cmd.userId, cmd.organizationId, cmd.accountId)

    const [row, user] = await Promise.all([
      this.accountRepo.findById(cmd.accountId, cmd.organizationId, cmd.userId),
      this.userRepo.findById(cmd.userId),
    ])
    const homeCurrency = user?.homeCurrency ?? "UAH"
    const rate = await this.exchangeRateService.getRate(
      row!.currency,
      homeCurrency,
      new Date(),
    )

    return {
      id: row!.id,
      name: row!.name,
      type: row!.type,
      currency: row!.currency,
      balance: row!.balance,
      homeBalance: row!.balance * rate,
      isDefault: row!.isDefault,
    }
  }
}
