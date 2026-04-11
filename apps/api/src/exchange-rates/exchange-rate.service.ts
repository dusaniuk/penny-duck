import { Injectable, Logger } from "@nestjs/common"
import { ExchangeRateClient } from "./exchange-rate.client"
import { ExchangeRateRepository } from "./exchange-rate.repository"

@Injectable()
export class ExchangeRateService {
  private readonly logger = new Logger(ExchangeRateService.name)

  constructor(
    private readonly client: ExchangeRateClient,
    private readonly repo: ExchangeRateRepository
  ) {}

  async getRate(base: string, target: string, date: Date): Promise<number> {
    if (base === target) return 1

    const dateStr = date.toISOString().split("T")[0]

    const cached = await this.repo.findRate(dateStr, base, target)
    if (cached !== null) return cached

    const allRates = await this.client.fetchRates(base, date)
    // Filter to fiat ISO codes only (max 3 chars) — crypto codes like 1INCH exceed DB column length.
    // Also drop rates that overflow pg integer when stored as rate × 1_000_000 (max 2,147,483,647).
    const PG_INT_MAX = 2_147_483_647
    const rates = Object.fromEntries(
      Object.entries(allRates).filter(
        ([code, value]) =>
          code.length <= 3 && Math.round(value * 1_000_000) <= PG_INT_MAX
      )
    )
    await this.repo.upsertRates(dateStr, base, rates)

    const rate = rates[target]
    if (rate === undefined) {
      this.logger.warn(`No rate found for ${base}->${target} on ${dateStr}`)
      return 1
    }

    return rate
  }

  async getLatestRates(
    currencies: string[]
  ): Promise<Record<string, Record<string, number>>> {
    const result: Record<string, Record<string, number>> = {}
    const today = new Date()

    for (const base of currencies) {
      result[base] = {}
      for (const target of currencies) {
        if (base === target) continue
        result[base][target] = await this.getRate(base, target, today)
      }
    }

    return result
  }
}
