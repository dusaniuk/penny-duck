import { Query, IQueryHandler, QueryHandler } from "@nestjs/cqrs"
import { type Transaction } from "@workspace/api-contract"
import { AccountRepository } from "@/accounts/account.repository"
import { ExchangeRateService } from "@/exchange-rates/exchange-rate.service"
import { TransactionRepository } from "../transaction.repository"
import { toResponse } from "../helpers/transaction.helpers"

interface ListFilters {
  page: number
  limit: number
  accountId?: string
  type?: string
  categoryId?: string
  settled?: boolean
  transfer?: boolean
  dateFrom?: Date
  dateTo?: Date
  madeById?: string
}

export class ListTransactionsQuery extends Query<{
  data: Transaction[]
  total: number
}> {
  constructor(
    public readonly organizationId: string,
    public readonly userId: string,
    public readonly homeCurrency: string,
    public readonly filters: ListFilters
  ) {
    super()
  }
}

@QueryHandler(ListTransactionsQuery)
export class ListTransactionsHandler implements IQueryHandler<ListTransactionsQuery> {
  constructor(
    private readonly transactionRepo: TransactionRepository,
    private readonly accountRepo: AccountRepository,
    private readonly exchangeRateService: ExchangeRateService
  ) {}

  async execute(
    query: ListTransactionsQuery
  ): Promise<{ data: Transaction[]; total: number }> {
    const { data, total } = await this.transactionRepo.findAll({
      organizationId: query.organizationId,
      ...query.filters,
    })

    if (data.length === 0) return { data: [], total }

    const accounts = await this.accountRepo.findAllByOrganizationId(
      query.organizationId,
      query.userId
    )
    const currencyByAccountId = new Map(
      accounts.map((a) => [a.id, a.currency])
    )
    const usedCurrencies = [...new Set(accounts.map((a) => a.currency))]

    const results: Transaction[] = []
    for (const row of data) {
      const currency = currencyByAccountId.get(row.accountId)
      let homeAmount = Math.abs(row.amount)

      if (currency && currency !== query.homeCurrency) {
        const rate = await this.exchangeRateService.getRate(
          currency,
          query.homeCurrency,
          row.date,
          usedCurrencies
        )
        homeAmount = Math.abs(row.amount) * rate
      }

      results.push(toResponse(row, homeAmount))
    }

    return { data: results, total }
  }
}
