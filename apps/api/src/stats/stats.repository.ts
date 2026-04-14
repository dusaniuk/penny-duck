import { Inject, Injectable } from "@nestjs/common"
import { sql } from "drizzle-orm"
import { type DbClient } from "@workspace/db"
import { DB_CLIENT } from "@/database/database.module"

export interface MonthlyCurrencyRow {
  month: string
  currency: string
  income: number
  expenses: number
}

@Injectable()
export class StatsRepository {
  constructor(@Inject(DB_CLIENT) private readonly db: DbClient) {}

  async getMonthlySummaryByCurrency(
    organizationId: string,
    months: number,
  ): Promise<MonthlyCurrencyRow[]> {
    const rows = await this.db.execute(sql`
      SELECT
        to_char(date_trunc('month', t.date), 'YYYY-MM') AS month,
        a.currency,
        COALESCE(SUM(CASE WHEN t.amount > 0 AND t.transfer_id IS NULL AND t.reimbursement_id IS NULL THEN t.amount ELSE 0 END), 0)::float / 100 AS income,
        COALESCE(SUM(CASE WHEN t.amount < 0 AND t.transfer_id IS NULL AND t.reimbursement_id IS NULL THEN ABS(t.amount) ELSE 0 END), 0)::float / 100 AS expenses
      FROM app.transactions t
      JOIN app.accounts a ON a.id = t.account_id
      WHERE t.organization_id = ${organizationId}
        AND t.date >= date_trunc('month', NOW()) - (${months} || ' months')::interval
      GROUP BY date_trunc('month', t.date), a.currency
      ORDER BY month ASC
    `)

    return rows.rows as unknown as MonthlyCurrencyRow[]
  }
}
