import { createFileRoute } from "@tanstack/react-router"
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts"
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@workspace/ui/components/chart"
import type { ChartConfig } from "@workspace/ui/components/chart"
import { tsr } from "@/lib/api"

export const Route = createFileRoute("/_app/income-expenses")({
  staticData: { breadcrumb: "Income vs Expenses" },
  component: IncomeExpensesPage,
})

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

function IncomeExpensesPage() {
  const { data, isLoading } = tsr.stats.monthlySummary.useQuery({
    queryKey: ["stats", "monthly-summary", 12],
    queryData: { query: { months: 12 } },
  })

  const chartData = (data?.body ?? []).map((item) => ({
    ...item,
    monthLabel: new Date(item.month + "-01").toLocaleDateString("en-US", {
      month: "short",
    }),
  }))

  const hasData = chartData.some((d) => d.income > 0 || d.expenses > 0)

  return (
    <div className="space-y-6">
      {isLoading ? (
        <div className="flex h-80 items-center justify-center">
          <div className="h-64 w-full animate-pulse rounded bg-muted" />
        </div>
      ) : !hasData ? (
        <div className="flex h-80 items-center justify-center text-muted-foreground">
          <p className="text-base">No data yet</p>
        </div>
      ) : (
        <ChartContainer config={chartConfig} className="h-80 w-full">
          <BarChart accessibilityLayer data={chartData}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="monthLabel"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
            />
            <YAxis tickLine={false} axisLine={false} width={60} />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="dashed" />}
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="income" fill="var(--color-income)" radius={4} />
            <Bar dataKey="expenses" fill="var(--color-expenses)" radius={4} />
          </BarChart>
        </ChartContainer>
      )}
    </div>
  )
}
