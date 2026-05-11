import { sql } from "drizzle-orm"
import { type MonthlySummaryItem } from "@workspace/api-contract"
import { db } from "@/db"
import { getRate } from "@/modules/exchange-rates/service"

interface MonthlyCurrencyRow {
  month: string
  currency: string
  income: number
  expenses: number
}

async function fetchMonthlyRowsByCurrency(
  organizationId: string,
  months: number,
): Promise<MonthlyCurrencyRow[]> {
  const rows = await db.execute(sql`
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

function generateMonthKeys(months: number): string[] {
  const keys: string[] = []
  const now = new Date()
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
  }
  return keys
}

export async function getMonthlySummary(
  organizationId: string,
  homeCurrency: string,
  months: number,
): Promise<MonthlySummaryItem[]> {
  const rows = await fetchMonthlyRowsByCurrency(organizationId, months)

  const currencies = [...new Set(rows.map((r) => r.currency))]
  const today = new Date()
  const rates = new Map<string, number>()

  await Promise.all(
    currencies.map(async (currency) => {
      const rate = await getRate(currency, homeCurrency, today, currencies)
      rates.set(currency, rate)
    }),
  )

  const monthMap = new Map<string, { income: number; expenses: number }>()
  for (const row of rows) {
    const rate = rates.get(row.currency) ?? 1
    const existing = monthMap.get(row.month) ?? { income: 0, expenses: 0 }
    existing.income += row.income * rate
    existing.expenses += row.expenses * rate
    monthMap.set(row.month, existing)
  }

  return generateMonthKeys(months).map((month) => {
    const data = monthMap.get(month)
    return {
      month,
      income: Math.round((data?.income ?? 0) * 100) / 100,
      expenses: Math.round((data?.expenses ?? 0) * 100) / 100,
    }
  })
}
