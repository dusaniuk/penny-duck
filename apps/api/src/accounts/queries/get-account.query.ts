import { NotFoundException } from "@nestjs/common"
import { Query, IQueryHandler, QueryHandler } from "@nestjs/cqrs"
import { type Account } from "@workspace/api-contract"
import { AccountRepository } from "../account.repository"
import { ExchangeRateService } from "@/exchange-rates/exchange-rate.service"
import { UserRepository } from "@/users/user.repository"

export class GetAccountQuery extends Query<Account> {
  constructor(
    public readonly id: string,
    public readonly organizationId: string,
    public readonly userId: string,
  ) {
    super()
  }
}

@QueryHandler(GetAccountQuery)
export class GetAccountHandler implements IQueryHandler<GetAccountQuery> {
  constructor(
    private readonly accountRepo: AccountRepository,
    private readonly exchangeRateService: ExchangeRateService,
    private readonly userRepo: UserRepository,
  ) {}

  async execute(query: GetAccountQuery): Promise<Account> {
    const [row, user] = await Promise.all([
      this.accountRepo.findById(query.id, query.organizationId, query.userId),
      this.userRepo.findById(query.userId),
    ])
    if (!row) throw new NotFoundException("Account not found")

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
