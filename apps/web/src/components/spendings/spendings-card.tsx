import { Link } from "@tanstack/react-router"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { SpendingsDonutChart } from "./spendings-donut-chart"
import { aggregateByCategory } from "./aggregate-by-category"
import { useMonthTransactions } from "./use-month-transactions"
import type { Category } from "@workspace/api-contract"

interface SpendingsCardProps {
  categories: Array<Category>
  homeCurrency: string
}

const now = new Date()
const CURRENT_YEAR = now.getFullYear()
const CURRENT_MONTH = now.getMonth()

const MONTH_LABEL = now.toLocaleDateString("en-US", {
  month: "long",
  year: "numeric",
})

export function SpendingsCard({
  categories,
  homeCurrency,
}: SpendingsCardProps) {
  const { data: transactions, isLoading } = useMonthTransactions(
    CURRENT_YEAR,
    CURRENT_MONTH,
  )
  const chartData = transactions
    ? aggregateByCategory(transactions, categories)
    : []

  return (
    <Link to="/spendings" className="block">
      <Card className="transition-colors hover:bg-muted/50">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Spendings</CardTitle>
          <span className="text-xs text-muted-foreground">
            {MONTH_LABEL} →
          </span>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex aspect-square items-center justify-center">
              <div className="size-24 animate-pulse rounded-full bg-muted" />
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex aspect-square items-center justify-center">
              <p className="text-sm text-muted-foreground">
                No spending this month
              </p>
            </div>
          ) : (
            <SpendingsDonutChart
              data={chartData}
              homeCurrency={homeCurrency}
              size="sm"
            />
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
