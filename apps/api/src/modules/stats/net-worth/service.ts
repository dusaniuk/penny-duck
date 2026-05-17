import { sql, eq } from "drizzle-orm"
import { type NetWorthResponse } from "@workspace/api-contract"
import { users } from "@workspace/db"
import { db } from "@/db"
import { listAccounts } from "@/modules/accounts/service"
import { getSummary } from "@/modules/investments/positions/service"
import { getRate } from "@/modules/exchange-rates/service"

const HISTORY_MONTHS = 12

function isoDate(d: Date): string {
  return d.toISOString().split("T")[0]
}

async function resolveHomeCurrency(userId: string): Promise<string> {
  const [row] = await db
    .select({ homeCurrency: users.homeCurrency })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  return row?.homeCurrency ?? "UAH"
}

interface MonthlyDeltaRow {
  month: string
  currency: string
  delta: number
}

async function fetchMonthlyDeltasByCurrency(
  organizationId: string,
  months: number,
): Promise<MonthlyDeltaRow[]> {
  const rows = await db.execute(sql`
    WITH txs AS (
      SELECT
        to_char(date_trunc('month', t.date), 'YYYY-MM') AS month,
        a.currency AS currency,
        COALESCE(SUM(t.amount), 0) AS cents
      FROM app.transactions t
      JOIN app.accounts a ON a.id = t.account_id
      WHERE t.organization_id = ${organizationId}
        AND t.date >= date_trunc('month', NOW()) - (${months - 1} || ' months')::interval
      GROUP BY date_trunc('month', t.date), a.currency
    ),
    trd AS (
      SELECT
        to_char(date_trunc('month', tr.date), 'YYYY-MM') AS month,
        a.currency AS currency,
        COALESCE(SUM(CASE
          WHEN tr.type = 'buy'      THEN -tr.amount
          WHEN tr.type = 'sell'     THEN tr.amount
          WHEN tr.type = 'dividend' THEN tr.amount + COALESCE(tr.withheld_tax, 0)
          ELSE 0
        END), 0) AS cents
      FROM app.trades tr
      JOIN app.accounts a ON a.id = tr.account_id
      WHERE tr.organization_id = ${organizationId}
        AND tr.date >= date_trunc('month', NOW()) - (${months - 1} || ' months')::interval
      GROUP BY date_trunc('month', tr.date), a.currency
    )
    SELECT month, currency, SUM(cents)::float / 100 AS delta
    FROM (
      SELECT * FROM txs
      UNION ALL
      SELECT * FROM trd
    ) combined
    GROUP BY month, currency
    ORDER BY month ASC
  `)

  return (
    rows.rows as unknown as Array<{
      month: string
      currency: string
      delta: number | string
    }>
  ).map((r) => ({
    month: r.month,
    currency: r.currency,
    delta: typeof r.delta === "string" ? Number(r.delta) : r.delta,
  }))
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

async function getMonthlyDeltasHome(
  organizationId: string,
  homeCurrency: string,
  months: number,
): Promise<Array<{ month: string; delta: number }>> {
  const rows = await fetchMonthlyDeltasByCurrency(organizationId, months)
  const currencies = [...new Set(rows.map((r) => r.currency))]
  const today = new Date()
  const rates = new Map<string, number>()
  await Promise.all(
    currencies.map(async (cur) => {
      const r = await getRate(cur, homeCurrency, today, currencies)
      rates.set(cur, r)
    }),
  )

  const byMonth = new Map<string, number>()
  for (const row of rows) {
    const rate = rates.get(row.currency) ?? 1
    byMonth.set(row.month, (byMonth.get(row.month) ?? 0) + row.delta * rate)
  }

  return generateMonthKeys(months).map((m) => ({
    month: m,
    delta: byMonth.get(m) ?? 0,
  }))
}

export async function getNetWorth(
  organizationId: string,
  userId: string,
): Promise<NetWorthResponse> {
  const accountRows = await listAccounts(organizationId, userId)
  const cash = accountRows.reduce((acc, r) => acc + r.homeBalance, 0)
  const summary = await getSummary(organizationId, userId)
  const investments = summary.totalValueHome
  const total = cash + investments
  const homeCurrency = await resolveHomeCurrency(userId)

  const topAccounts = [...accountRows]
    .sort((a, b) => b.homeBalance - a.homeBalance)
    .slice(0, 3)
    .map((a) => ({ id: a.id, name: a.name, homeBalance: a.homeBalance }))

  const monthlyDeltas = await getMonthlyDeltasHome(
    organizationId,
    homeCurrency,
    HISTORY_MONTHS,
  )

  // Walk back from today through monthly deltas (newest first).
  const points: Array<{ date: string; total: number }> = [
    { date: isoDate(new Date()), total },
  ]
  let cursor = total
  for (let i = monthlyDeltas.length - 1; i >= 0; i--) {
    cursor -= monthlyDeltas[i].delta
    points.push({ date: `${monthlyDeltas[i].month}-01`, total: cursor })
  }
  points.reverse()

  let change: NetWorthResponse["history"]["change"] = null
  if (points.length >= 2 && points[0].total !== 0) {
    const first = points[0].total
    const absolute = total - first
    const percent = (absolute / first) * 100
    change = { absolute, percent }
  }

  return {
    current: {
      total,
      cash,
      investments,
      homeCurrency,
      pricesStale: summary.pricesStale,
      accountsCount: accountRows.length,
      topAccounts,
    },
    history: { points, change },
  }
}
