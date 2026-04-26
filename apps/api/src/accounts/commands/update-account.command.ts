import { NotFoundException } from "@nestjs/common"
import { Command, CommandHandler, ICommandHandler } from "@nestjs/cqrs"
import { type Account } from "@workspace/api-contract"
import { AccountRepository } from "../account.repository"
import { ExchangeRateService } from "@/exchange-rates/exchange-rate.service"
import { UserRepository } from "@/users/user.repository"

export class UpdateAccountCommand extends Command<Account> {
  constructor(
    public readonly id: string,
    public readonly organizationId: string,
    public readonly userId: string,
    public readonly name?: string,
    public readonly type?: string,
  ) {
    super()
  }
}

@CommandHandler(UpdateAccountCommand)
export class UpdateAccountHandler
  implements ICommandHandler<UpdateAccountCommand>
{
  constructor(
    private readonly accountRepo: AccountRepository,
    private readonly exchangeRateService: ExchangeRateService,
    private readonly userRepo: UserRepository,
  ) {}

  async execute(cmd: UpdateAccountCommand): Promise<Account> {
    const existing = await this.accountRepo.findById(
      cmd.id,
      cmd.organizationId,
      cmd.userId,
    )
    if (!existing) throw new NotFoundException("Account not found")

    const [row, user] = await Promise.all([
      this.accountRepo.update(cmd.id, cmd.organizationId, cmd.userId, {
        name: cmd.name,
        type: cmd.type,
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
      isDefault: row.isDefault,
    }
  }
}
