import { Query, IQueryHandler, QueryHandler } from "@nestjs/cqrs"
import { AccountRepository } from "@/accounts/account.repository"
import { ExchangeRateService } from "../exchange-rate.service"

export class GetLatestRatesQuery extends Query<{
  date: string
  rates: Record<string, Record<string, number>>
}> {
  constructor(public readonly organizationId: string) {
    super()
  }
}

@QueryHandler(GetLatestRatesQuery)
export class GetLatestRatesHandler
  implements IQueryHandler<GetLatestRatesQuery>
{
  constructor(
    private readonly accountRepo: AccountRepository,
    private readonly exchangeRateService: ExchangeRateService,
  ) {}

  async execute(query: GetLatestRatesQuery) {
    const accounts = await this.accountRepo.findAllByOrganizationId(
      query.organizationId,
    )
    const currencies = [...new Set(accounts.map((a) => a.currency))]

    if (currencies.length <= 1) {
      return { date: new Date().toISOString().split("T")[0], rates: {} }
    }

    const rates = await this.exchangeRateService.getLatestRates(currencies)
    return { date: new Date().toISOString().split("T")[0], rates }
  }
}
