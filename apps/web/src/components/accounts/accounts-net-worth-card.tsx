import { useMemo } from "react"
import { Amount } from "@workspace/ui/components/amount"
import { Card, CardContent } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"
import { buildNetWorthBreakdown } from "./net-worth-breakdown"
import type { AssetGroup, LiabilityGroup } from "./net-worth-breakdown"
import type { Account, NetWorthResponse, Wallet } from "@workspace/api-contract"
import { queryClient } from "@/lib/api"

const ASSET_LABEL: Record<AssetGroup, string> = {
  bank: "Bank",
  brokerage: "Brokerage",
  wallet: "Wallet",
}

const ASSET_BG: Record<AssetGroup, string> = {
  bank: "bg-chart-1",
  brokerage: "bg-chart-3",
  wallet: "bg-chart-2",
}

const LIABILITY_LABEL: Record<LiabilityGroup, string> = {
  loan: "Loan",
}

const LIABILITY_BG: Record<LiabilityGroup, string> = {
  loan: "bg-chart-4",
}

type Props = {
  accounts: Array<Account>
  wallets: Array<Wallet>
}

export function AccountsNetWorthCard({ accounts, wallets }: Props) {
  const { assets, liabilities, net, currencyCount, totalEntities } = useMemo(
    () => buildNetWorthBreakdown(accounts, wallets),
    [accounts, wallets]
  )

  const homeCurrency =
    queryClient.getQueryData<NetWorthResponse>(["stats", "net-worth"])?.current
      .homeCurrency ?? ""

  const hasLiabilities = liabilities.rows.length > 0
  const headline = hasLiabilities ? net : assets.total
  const headlineLabel = hasLiabilities ? "Net worth" : "Total net worth"

  const assetRows = assets.rows.map((r) => ({
    ...r,
    label: ASSET_LABEL[r.type],
    bg: ASSET_BG[r.type],
  }))
  const liabilityRows = liabilities.rows.map((r) => ({
    ...r,
    label: LIABILITY_LABEL[r.type],
    bg: LIABILITY_BG[r.type],
  }))

  return (
    <Card role="region" aria-label={`${headlineLabel} summary`}>
      <CardContent className="grid gap-6 sm:grid-cols-[minmax(220px,1fr)_1px_1.6fr] sm:gap-7">
        {/* Headline */}
        <div>
          <p className="text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
            {headlineLabel}
          </p>
          <Amount
            size="hero"
            value={headline}
            currency={homeCurrency || undefined}
            className="mt-2 block"
          />
          <p className="mt-2 text-xs text-muted-foreground/80">
            across {totalEntities} account{totalEntities === 1 ? "" : "s"} in{" "}
            {currencyCount} currenc{currencyCount === 1 ? "y" : "ies"}
          </p>
          {hasLiabilities && (
            <p className="mt-3 font-mono text-[10.5px] tracking-widest text-muted-foreground/70 uppercase">
              Assets − Liabilities
            </p>
          )}
        </div>

        {/* Hairline divider — desktop only */}
        <div aria-hidden className="hidden bg-border sm:block" />

        {/* Breakdown */}
        <div className="space-y-5 sm:h-full">
          <BreakdownSection
            label={hasLiabilities ? "Assets" : null}
            rows={assetRows}
            total={assets.total}
            homeCurrency={homeCurrency}
          />
          {hasLiabilities && (
            <BreakdownSection
              label="Liabilities"
              rows={liabilityRows}
              total={liabilities.total}
              homeCurrency={homeCurrency}
            />
          )}
        </div>
      </CardContent>
    </Card>
  )
}

type SectionRow = {
  type: string
  value: number
  pct: number
  label: string
  bg: string
}

function BreakdownSection({
  label,
  rows,
  total,
  homeCurrency,
}: {
  label: string | null
  rows: Array<SectionRow>
  total: number
  homeCurrency: string
}) {
  return (
    <div className="space-y-2">
      {label && (
        <div className="flex items-baseline justify-between">
          <p className="font-mono text-[10.5px] tracking-widest text-muted-foreground uppercase">
            {label}
          </p>
          <Amount
            value={total}
            currency={homeCurrency || undefined}
            className="text-[12px] font-semibold"
          />
        </div>
      )}
      <div className="space-y-2.5">
        {rows.map((r) => (
          <div
            key={r.type}
            className="grid grid-cols-[110px_1fr_auto] items-center gap-3.5"
          >
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className={cn("size-2 shrink-0 rounded-full", r.bg)}
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
              aria-label={`${r.label}, ${r.pct.toFixed(0)}% of ${label ?? "total net worth"}`}
              className="h-1.5 rounded-full bg-muted"
            >
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-300",
                  r.bg
                )}
                style={{ width: `${r.pct}%` }}
              />
            </div>
            <Amount
              value={r.value}
              currency={homeCurrency || undefined}
              className="text-right text-sm font-medium"
            />
          </div>
        ))}
      </div>
    </div>
  )
}
