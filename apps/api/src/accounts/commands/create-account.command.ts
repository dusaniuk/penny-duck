import { Command, CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import { type Account } from "@workspace/api-contract"
import { AccountRepository } from "../account.repository"
import { ExchangeRateService } from "@/exchange-rates/exchange-rate.service"
import { UserRepository } from "@/users/user.repository"

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
  constructor(
    private readonly accountRepo: AccountRepository,
    private readonly exchangeRateService: ExchangeRateService,
    private readonly userRepo: UserRepository,
  ) {}

  async execute(cmd: CreateAccountCommand): Promise<Account> {
    const [row, user] = await Promise.all([
      this.accountRepo.insert({
        organizationId: cmd.organizationId,
        name: cmd.name,
        type: cmd.type,
        currency: cmd.currency,
        initialBalance: cmd.balance,
      }),
      this.userRepo.findById(cmd.userId),
    ])

    const homeCurrency = user?.homeCurrency ?? "UAH"
    const rate = await this.exchangeRateService.getRate(
      row.currency,
      homeCurrency,
      new Date(),
    )

    return {
      id: row.id,
      name: row.name,
      type: row.type,
      currency: row.currency,
      balance: row.balance,
      homeBalance: row.balance * rate,
    }
  }
}
