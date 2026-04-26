import { Card, CardContent } from "@workspace/ui/components/card"
import type { InvestmentsSummary } from "@workspace/api-contract"

function fmt(n: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
  }).format(n)
}

interface PortfolioSummaryProps {
  summary: InvestmentsSummary
  homeCurrency: string
}

export function PortfolioSummary({
  summary,
  homeCurrency,
}: PortfolioSummaryProps) {
  const tiles: Array<{
    label: string
    value: string
    tone?: "positive" | "negative"
  }> = [
    {
      label: "Total value",
      value: fmt(summary.totalValueHome, homeCurrency),
    },
    {
      label: "Total cost",
      value: fmt(summary.totalCostHome, homeCurrency),
    },
    {
      label: "Unrealized P&L",
      value: fmt(summary.totalUnrealizedGainHome, homeCurrency),
      tone: summary.totalUnrealizedGainHome >= 0 ? "positive" : "negative",
    },
    {
      label: "Realized P&L",
      value: fmt(summary.totalRealizedGainHome, homeCurrency),
      tone: summary.totalRealizedGainHome >= 0 ? "positive" : "negative",
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {tiles.map((t) => (
        <Card key={t.label}>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">{t.label}</div>
            <div
              className={
                t.tone === "positive"
                  ? "text-emerald-600"
                  : t.tone === "negative"
                    ? "text-rose-600"
                    : ""
              }
            >
              <span className="text-xl font-semibold tabular-nums">
                {t.value}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
