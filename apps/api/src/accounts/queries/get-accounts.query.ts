import { Query, IQueryHandler, QueryHandler } from "@nestjs/cqrs"
import { type Account } from "@workspace/api-contract"
import { AccountRepository } from "../account.repository"
import { ExchangeRateService } from "@/exchange-rates/exchange-rate.service"
import { UserRepository } from "@/users/user.repository"

export class GetAccountsQuery extends Query<Account[]> {
  constructor(
    public readonly organizationId: string,
    public readonly userId: string,
  ) {
    super()
  }
}

@QueryHandler(GetAccountsQuery)
export class GetAccountsHandler implements IQueryHandler<GetAccountsQuery> {
  constructor(
    private readonly accountRepo: AccountRepository,
    private readonly exchangeRateService: ExchangeRateService,
    private readonly userRepo: UserRepository,
  ) {}

  async execute(query: GetAccountsQuery): Promise<Account[]> {
    const [rows, user] = await Promise.all([
      this.accountRepo.findAllByOrganizationId(query.organizationId),
      this.userRepo.findById(query.userId),
    ])

    const homeCurrency = user?.homeCurrency ?? "UAH"
    const today = new Date()
    const currencies = [...new Set(rows.map((r) => r.currency))]

    const rates = new Map<string, number>()
    await Promise.all(
      currencies.map(async (currency) => {
        const rate = await this.exchangeRateService.getRate(
          currency,
          homeCurrency,
          today,
          currencies,
        )
        rates.set(currency, rate)
      }),
    )

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      currency: r.currency,
      balance: r.balance,
      homeBalance: r.balance * (rates.get(r.currency) ?? 1),
    }))
  }
}
