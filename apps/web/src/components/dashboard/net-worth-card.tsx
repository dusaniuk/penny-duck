import { useQuery } from "@tanstack/react-query"
import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import { Card, CardContent, CardHeader } from "@workspace/ui/components/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@workspace/ui/components/chart"
import type { ChartConfig } from "@workspace/ui/components/chart"
import { api } from "@/lib/api"

const chartConfig = {
  total: {
    label: "Net worth",
    color: "var(--color-chart-1)",
  },
} satisfies ChartConfig

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

export function NetWorthCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["stats", "net-worth"],
    queryFn: async () => {
      const res = await api.stats["net-worth"].$get()
      if (!res.ok) throw await res.json()
      return res.json()
    },
  })

  if (isLoading || !data) {
    return (
      <Card className="h-full">
        <CardContent className="flex h-64 items-center justify-center">
          <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        </CardContent>
      </Card>
    )
  }

  const { current, history } = data
  const { whole, fraction } = formatAmount(current.total)

  return (
    <Card className="h-full">
      <CardHeader className="hidden md:flex md:flex-row md:items-center md:pb-2">
        <span className="text-xs tracking-wider text-muted-foreground uppercase">
          Net worth · {current.homeCurrency}
          {current.pricesStale && (
            <span className="ml-2 text-[10px] text-muted-foreground">
              prices may be stale
            </span>
          )}
        </span>
      </CardHeader>

      {/* Mobile header */}
      <CardHeader className="md:hidden">
        <span className="text-xs tracking-wider text-muted-foreground uppercase">
          Net worth
        </span>
      </CardHeader>

      <CardContent className="space-y-4">
        <div>
          <p className="font-mono text-5xl font-bold tracking-tight tabular-nums md:text-6xl">
            <span>{whole}</span>
            <span className="text-muted-foreground/50">.{fraction}</span>
          </p>

          {/* Mobile sub-line: total across N accounts */}
          <p className="mt-2 text-xs tracking-wider text-muted-foreground uppercase md:hidden">
            {current.homeCurrency} · total across {current.accountsCount}{" "}
            account{current.accountsCount === 1 ? "" : "s"}
          </p>
        </div>

        {/* Desktop chart */}
        {history.points.length >= 2 ? (
          <ChartContainer
            config={chartConfig}
            className="hidden h-48 w-full md:block"
          >
            <AreaChart accessibilityLayer data={history.points}>
              <defs>
                <linearGradient id="net-worth-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--color-total)"
                    stopOpacity={0.4}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--color-total)"
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tickLine={false}
                tickMargin={8}
                axisLine={false}
                fontSize={11}
                tickFormatter={(d: string) =>
                  new Date(d)
                    .toLocaleDateString("en-US", { month: "short" })
                    .toUpperCase()
                }
              />
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="line" />}
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke="var(--color-total)"
                fill="url(#net-worth-fill)"
                strokeWidth={2}
              />
            </AreaChart>
          </ChartContainer>
        ) : (
          <div className="hidden h-48 items-center justify-center text-sm text-muted-foreground md:flex">
            Building history…
          </div>
        )}

        {/* Mobile top-accounts grid */}
        {current.topAccounts.length > 0 && (
          <div className="grid grid-cols-3 gap-2 md:hidden">
            {current.topAccounts.map(
              (a: { id: string; name: string; homeBalance: number }) => (
                <div
                  key={a.id}
                  className="rounded-md border border-border/50 p-3"
                >
                  <p className="truncate text-[10px] tracking-wider text-muted-foreground uppercase">
                    {a.name}
                  </p>
                  <p className="font-mono text-base font-semibold tabular-nums">
                    {formatInt(a.homeBalance)}
                  </p>
                </div>
              )
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
