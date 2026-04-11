import { Inject, Injectable } from "@nestjs/common"
import { and, eq, sql } from "drizzle-orm"
import { type DbClient, exchangeRates } from "@workspace/db"
import { DB_CLIENT } from "@/database/database.module"

@Injectable()
export class ExchangeRateRepository {
  constructor(@Inject(DB_CLIENT) private readonly db: DbClient) {}

  async findRate(date: string, base: string, target: string): Promise<number | null> {
    const rows = await this.db
      .select({ rate: exchangeRates.rate })
      .from(exchangeRates)
      .where(
        and(
          eq(exchangeRates.date, date),
          eq(exchangeRates.base, base),
          eq(exchangeRates.target, target)
        )
      )
      .limit(1)

    return rows[0]?.rate ?? null
  }

  async findRates(date: string, base: string): Promise<Record<string, number>> {
    const rows = await this.db
      .select({ target: exchangeRates.target, rate: exchangeRates.rate })
      .from(exchangeRates)
      .where(and(eq(exchangeRates.date, date), eq(exchangeRates.base, base)))

    const result: Record<string, number> = {}
    for (const row of rows) {
      result[row.target] = row.rate
    }
    return result
  }

  async upsertRates(date: string, base: string, rates: Record<string, number>): Promise<void> {
    const values = Object.entries(rates).map(([target, rate]) => ({
      date,
      base,
      target,
      rate,
    }))

    if (values.length === 0) return

    await this.db
      .insert(exchangeRates)
      .values(values)
      .onConflictDoUpdate({
        target: [exchangeRates.date, exchangeRates.base, exchangeRates.target],
        set: { rate: sql`excluded.rate` },
      })
  }
}
