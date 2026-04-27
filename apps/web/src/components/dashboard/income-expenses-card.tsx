import { Link } from "@tanstack/react-router"
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@workspace/ui/components/chart"
import type { ChartConfig } from "@workspace/ui/components/chart"
import { tsr } from "@/lib/api"

const chartConfig = {
  income: {
    label: "Income",
    color: "var(--color-chart-7)",
  },
  expenses: {
    label: "Expenses",
    color: "var(--color-chart-6)",
  },
} satisfies ChartConfig

export function IncomeExpensesCard() {
  const { data, isLoading } = tsr.stats.monthlySummary.useQuery({
    queryKey: ["stats", "monthly-summary", 6],
    queryData: { query: { months: 6 } },
  })

  const chartData = (data?.body ?? []).map((item) => ({
    ...item,
    monthLabel: new Date(item.month + "-01").toLocaleDateString("en-US", {
      month: "short",
    }),
  }))

  const hasData = chartData.some((d) => d.income > 0 || d.expenses > 0)

  return (
    <Link to="/income-expenses" className="block h-full">
      <Card className="h-full transition-colors hover:bg-muted/50">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">
            Income vs Expenses
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <div className="h-32 w-full animate-pulse rounded bg-muted" />
            </div>
          ) : !hasData ? (
            <div className="flex h-40 items-center justify-center">
              <p className="text-sm text-muted-foreground">No data yet</p>
            </div>
          ) : (
            <ChartContainer config={chartConfig} className="h-40 w-full">
              <BarChart accessibilityLayer data={chartData}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="monthLabel"
                  tickLine={false}
                  tickMargin={8}
                  axisLine={false}
                  fontSize={12}
                />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="dashed" />}
                />
                <Bar dataKey="income" fill="var(--color-income)" radius={4} />
                <Bar
                  dataKey="expenses"
                  fill="var(--color-expenses)"
                  radius={4}
                />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
