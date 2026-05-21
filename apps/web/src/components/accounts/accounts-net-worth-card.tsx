import { useMemo } from "react"
import { Card, CardContent } from "@workspace/ui/components/card"
import type { Account, NetWorthResponse } from "@workspace/api-contract"
import { queryClient } from "@/lib/api"

type AccountType = "bank" | "brokerage" | "cash"

const TYPE_ORDER: Array<AccountType> = ["bank", "brokerage", "cash"]

const TYPE_LABEL: Record<AccountType, string> = {
  bank: "Bank",
  brokerage: "Brokerage",
  cash: "Cash",
}

const TYPE_COLOR: Record<AccountType, string> = {
  bank: "oklch(0.72 0.15 50)",
  brokerage: "oklch(0.65 0.18 290)",
  cash: "oklch(0.72 0.18 145)",
}

function formatAmount(n: number): { whole: string; fraction: string } {
  const parts = n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const [whole, fraction] = parts.split(".")
  return { whole, fraction: fraction ?? "00" }
}

function formatInt(n: number): string {
  return Math.round(n).toLocaleString("en-US")
}

type Props = {
  accounts: Array<Account>
  holdingsByAccount: Map<string, number>
  holdingsLoaded: boolean
}

export function AccountsNetWorthCard({
  accounts,
  holdingsByAccount,
  holdingsLoaded,
}: Props) {
  const hasBrokerage = accounts.some((a) => a.type === "brokerage")
  const brokerageReady = !hasBrokerage || holdingsLoaded

  const { total, byType, currencyCount } = useMemo(() => {
    const sums: Record<AccountType, number> = {
      bank: 0,
      brokerage: 0,
      cash: 0,
    }
    let running = 0
    const currencies = new Set<string>()
    for (const a of accounts) {
      currencies.add(a.currency)
      if (a.type === "brokerage" && !brokerageReady) continue
      const value =
        a.type === "brokerage"
          ? a.homeBalance + (holdingsByAccount.get(a.id) ?? 0)
          : a.homeBalance
      running += value
      if (a.type === "bank" || a.type === "brokerage" || a.type === "cash") {
        sums[a.type] += value
      }
    }
    return { total: running, byType: sums, currencyCount: currencies.size }
  }, [accounts, holdingsByAccount, brokerageReady])

  const homeCurrency =
    queryClient.getQueryData<NetWorthResponse>(["stats", "net-worth"])?.current
      .homeCurrency ?? ""

  const { whole, fraction } = formatAmount(total)

  const rows = TYPE_ORDER.filter((t) => {
    if (!accounts.some((a) => a.type === t)) return false
    if (t === "brokerage" && !brokerageReady) return false
    return true
  }).map((t) => ({
    type: t,
    label: TYPE_LABEL[t],
    color: TYPE_COLOR[t],
    value: byType[t],
    pct: total > 0 ? (byType[t] / total) * 100 : 0,
  }))

  return (
    <Card role="region" aria-label="Total net worth summary">
      <CardContent className="grid gap-6 sm:grid-cols-[minmax(220px,1fr)_1px_1.6fr] sm:gap-7">
        {/* Total */}
        <div>
          <p className="text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
            Total net worth
          </p>
          <p className="mt-2 flex items-baseline gap-2 font-mono text-4xl font-semibold tracking-tight tabular-nums">
            <span>
              <span>{whole}</span>
              <span className="text-muted-foreground/50">.{fraction}</span>
            </span>
            {homeCurrency && (
              <span className="text-sm font-medium tracking-[0.04em] text-muted-foreground">
                {homeCurrency}
              </span>
            )}
          </p>
          <p className="mt-2 text-xs text-muted-foreground/80">
            across {accounts.length} account
            {accounts.length === 1 ? "" : "s"} in {currencyCount} currenc
            {currencyCount === 1 ? "y" : "ies"}
          </p>
        </div>

        {/* Hairline divider — desktop only */}
        <div aria-hidden className="hidden bg-border sm:block" />

        {/* Breakdown */}
        <div className="space-y-4 sm:h-full sm:space-y-0">
          {/* Desktop: per-type bars */}
          <div className="hidden h-full flex-col justify-center gap-3 sm:flex">
            {rows.map((r) => (
              <div
                key={r.type}
                className="grid grid-cols-[110px_1fr_auto] items-center gap-3.5"
              >
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: r.color }}
                  />
                  <span className="text-sm font-medium">{r.label}</span>
                  <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                    {r.pct.toFixed(0)}%
                  </span>
                </div>
                <div
                  role="progressbar"
                  aria-valuenow={Math.round(r.pct)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`${r.label}, ${r.pct.toFixed(0)}% of total net worth`}
                  className="h-1.5 rounded-full bg-muted"
                >
                  <div
                    className="h-full rounded-full transition-[width] duration-300"
                    style={{
                      width: `${r.pct}%`,
                      background: r.color,
                    }}
                  />
                </div>
                <div className="text-right text-sm font-medium tabular-nums">
                  {formatInt(r.value)}
                  {homeCurrency && (
                    <span className="ml-1 text-[11px] text-muted-foreground">
                      {homeCurrency}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Mobile: stacked single bar + legend */}
          <div className="sm:hidden">
            <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-muted">
              {rows.map((r) =>
                r.pct > 0 ? (
                  <span
                    key={r.type}
                    aria-hidden
                    className="h-full rounded-full transition-[flex-grow] duration-300"
                    style={{ flex: r.pct, background: r.color }}
                  />
                ) : null
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5 text-[11px]">
              {rows.map((r) => (
                <span key={r.type} className="inline-flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="size-1.5 rounded-full"
                    style={{ background: r.color }}
                  />
                  <span className="font-medium">{r.label}</span>
                  <span className="font-mono text-muted-foreground">
                    {r.pct.toFixed(0)}%
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
