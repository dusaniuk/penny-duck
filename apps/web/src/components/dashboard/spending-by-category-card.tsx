import { useQuery } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { Cell, Label, Pie, PieChart } from "recharts"
import { Card, CardContent, CardHeader } from "@workspace/ui/components/card"
import { useLocale } from "@workspace/ui/components/locale-provider"
import { formatMoney } from "@workspace/ui/lib/money"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@workspace/ui/components/chart"
import type { ChartConfig } from "@workspace/ui/components/chart"
import type { SpendingByCategoryItem } from "@workspace/api-contract"
import { api, unwrap } from "@/lib/api"
import { paletteColor } from "@/lib/palette"

const chartConfig = {} satisfies ChartConfig

const TOP_CATEGORIES = 5

interface DisplaySlice {
  key: string
  name: string
  amount: number
  fill: string
}

function toSlices(
  categories: Array<SpendingByCategoryItem>
): Array<DisplaySlice> {
  const top = categories.slice(0, TOP_CATEGORIES)
  const rest = categories.slice(TOP_CATEGORIES)

  const slices: Array<DisplaySlice> = top.map((c) => ({
    key: c.id ?? "uncategorized",
    name: c.name,
    amount: c.amount,
    fill: paletteColor(c.color),
  }))

  const otherAmount = rest.reduce((sum, c) => sum + c.amount, 0)
  if (otherAmount > 0) {
    slices.push({
      key: "other",
      name: "Other",
      amount: otherAmount,
      fill: paletteColor("gray"),
    })
  }
  return slices
}

export function SpendingByCategoryCard() {
  const locale = useLocale()
  const { data, isLoading } = useQuery({
    queryKey: ["stats", "spending-by-category"],
    queryFn: () => unwrap(api.stats["spending-by-category"].$get()),
  })

  const monthLabel = data
    ? new Date(data.month + "-01").toLocaleDateString("en-US", {
        month: "long",
      })
    : ""
  const slices = data ? toSlices(data.categories) : []

  return (
    <Link to="/spendings" className="block h-full">
      <Card className="h-full transition-colors hover:bg-muted/50">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <span className="text-xs tracking-wider text-muted-foreground uppercase">
            By Category
          </span>
          <span className="text-sm text-muted-foreground">{monthLabel}</span>
        </CardHeader>

        <CardContent>
          {isLoading || !data ? (
            <div className="flex h-40 items-center justify-center">
              <div className="size-32 animate-pulse rounded-full bg-muted" />
            </div>
          ) : slices.length === 0 ? (
            <div className="flex h-40 items-center justify-center">
              <p className="text-sm text-muted-foreground">
                No spending this month
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <ChartContainer
                config={chartConfig}
                className="aspect-square h-40 shrink-0"
              >
                <PieChart>
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent nameKey="name" hideLabel />}
                  />
                  <Pie
                    data={slices}
                    dataKey="amount"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={72}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {slices.map((slice) => (
                      <Cell key={slice.key} fill={slice.fill} />
                    ))}
                    <Label
                      content={({ viewBox }) => {
                        if (
                          !viewBox ||
                          !("cx" in viewBox) ||
                          !("cy" in viewBox)
                        ) {
                          return null
                        }
                        return (
                          <text
                            x={viewBox.cx}
                            y={viewBox.cy}
                            textAnchor="middle"
                            dominantBaseline="middle"
                          >
                            <tspan
                              x={viewBox.cx}
                              y={viewBox.cy}
                              className="fill-foreground font-mono text-lg font-bold tabular-nums"
                            >
                              {formatMoney(data.total, { locale })}
                            </tspan>
                            <tspan
                              x={viewBox.cx}
                              y={(viewBox.cy ?? 0) + 18}
                              className="fill-muted-foreground text-[10px] tracking-wider uppercase"
                            >
                              {data.homeCurrency}
                            </tspan>
                          </text>
                        )
                      }}
                    />
                  </Pie>
                </PieChart>
              </ChartContainer>

              <ul className="min-w-0 flex-1 space-y-2">
                {slices.map((slice) => (
                  <li
                    key={slice.key}
                    className="flex items-center gap-2 text-sm"
                  >
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ background: slice.fill }}
                    />
                    <span className="truncate">{slice.name}</span>
                    <span className="ml-auto text-muted-foreground tabular-nums">
                      {Math.round((slice.amount / data.total) * 100)}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
