import { useState } from "react"
import { Label, Pie, PieChart } from "recharts"
import { useLocale } from "@workspace/ui/components/locale-provider"
import { formatMoney } from "@workspace/ui/lib/money"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@workspace/ui/components/chart"
import type { ChartConfig } from "@workspace/ui/components/chart"
import type { CategorySpending } from "./aggregate-by-category"

interface SpendingsDonutChartProps {
  data: Array<CategorySpending>
  homeCurrency: string
  size?: "sm" | "lg"
  activeCategory?: string | null
  onSliceClick?: (categoryId: string) => void
}

function buildChartConfig(data: Array<CategorySpending>): ChartConfig {
  const config: ChartConfig = {}
  for (const item of data) {
    config[item.categoryId] = {
      label: item.categoryName,
      color: item.fill,
    }
  }
  return config
}

export function SpendingsDonutChart({
  data,
  homeCurrency,
  size = "sm",
  activeCategory,
  onSliceClick,
}: SpendingsDonutChartProps) {
  const locale = useLocale()
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null)
  const grandTotal = data.reduce((sum, d) => sum + d.total, 0)

  const hovered = data.find((d) => d.categoryId === hoveredCategory)
  const centerLabel = hovered ? hovered.categoryName : "Total Spending"
  const centerValue = hovered ? hovered.total : grandTotal

  const chartConfig = buildChartConfig(data)
  const dimensions =
    size === "lg" ? { width: 280, height: 280 } : { width: 200, height: 200 }
  const innerRadius = size === "lg" ? 80 : 55
  const outerRadius = size === "lg" ? 130 : 90

  const chartData = data.map((d) => ({
    ...d,
    opacity: activeCategory && activeCategory !== d.categoryId ? 0.3 : 1,
  }))

  return (
    <ChartContainer config={chartConfig} className="mx-auto" style={dimensions}>
      <PieChart>
        <ChartTooltip content={<ChartTooltipContent hideLabel />} />
        <Pie
          data={chartData}
          dataKey="total"
          nameKey="categoryName"
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          strokeWidth={2}
          stroke="hsl(var(--background))"
          onMouseEnter={(_: unknown, index: number) =>
            setHoveredCategory(chartData[index].categoryId)
          }
          onMouseLeave={() => setHoveredCategory(null)}
          onClick={(_: unknown, index: number) =>
            onSliceClick?.(chartData[index].categoryId)
          }
          style={{ cursor: onSliceClick ? "pointer" : "default" }}
        >
          <Label
            content={(props) => {
              const viewBox = (
                props as { viewBox?: { cx?: number; cy?: number } }
              ).viewBox
              if (viewBox && "cx" in viewBox && "cy" in viewBox) {
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
                      className="fill-foreground text-xl font-bold"
                    >
                      {formatMoney(centerValue, {
                        locale,
                        currency: homeCurrency,
                      })}
                    </tspan>
                    <tspan
                      x={viewBox.cx}
                      y={(viewBox.cy ?? 0) + 20}
                      className="fill-muted-foreground text-xs"
                    >
                      {centerLabel}
                    </tspan>
                  </text>
                )
              }
            }}
          />
        </Pie>
      </PieChart>
    </ChartContainer>
  )
}
