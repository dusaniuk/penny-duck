import { Query, IQueryHandler, QueryHandler } from "@nestjs/cqrs"
import { type MonthlySummaryItem } from "@workspace/api-contract"
import { ExchangeRateService } from "@/exchange-rates/exchange-rate.service"
import { StatsRepository } from "../stats.repository"

export class GetMonthlySummaryQuery extends Query<MonthlySummaryItem[]> {
  constructor(
    public readonly organizationId: string,
    public readonly homeCurrency: string,
    public readonly months: number,
  ) {
    super()
  }
}

function generateMonthKeys(months: number): string[] {
  const keys: string[] = []
  const now = new Date()
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    keys.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    )
  }
  return keys
}

@QueryHandler(GetMonthlySummaryQuery)
export class GetMonthlySummaryHandler
  implements IQueryHandler<GetMonthlySummaryQuery>
{
  constructor(
    private readonly statsRepo: StatsRepository,
    private readonly exchangeRateService: ExchangeRateService,
  ) {}

  async execute(query: GetMonthlySummaryQuery): Promise<MonthlySummaryItem[]> {
    const rows = await this.statsRepo.getMonthlySummaryByCurrency(
      query.organizationId,
      query.months,
    )

    // Collect unique currencies for rate lookups
    const currencies = [...new Set(rows.map((r) => r.currency))]
    const today = new Date()
    const rates = new Map<string, number>()

    await Promise.all(
      currencies.map(async (currency) => {
        const rate = await this.exchangeRateService.getRate(
          currency,
          query.homeCurrency,
          today,
          currencies,
        )
        rates.set(currency, rate)
      }),
    )

    // Merge per-currency rows into per-month totals
    const monthMap = new Map<string, { income: number; expenses: number }>()
    for (const row of rows) {
      const rate = rates.get(row.currency) ?? 1
      const existing = monthMap.get(row.month) ?? { income: 0, expenses: 0 }
      existing.income += row.income * rate
      existing.expenses += row.expenses * rate
      monthMap.set(row.month, existing)
    }

    // Zero-fill missing months
    const monthKeys = generateMonthKeys(query.months)
    return monthKeys.map((month) => {
      const data = monthMap.get(month)
      return {
        month,
        income: Math.round((data?.income ?? 0) * 100) / 100,
        expenses: Math.round((data?.expenses ?? 0) * 100) / 100,
      }
    })
  }
}
