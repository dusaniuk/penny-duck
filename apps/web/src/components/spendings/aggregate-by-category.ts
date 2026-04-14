import type { Category, Transaction } from "@workspace/api-contract"

export interface CategorySpending {
  categoryId: string
  categoryName: string
  icon: string | null
  total: number
  fill: string
}

const CHART_COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-6)",
  "var(--color-chart-7)",
  "var(--color-chart-8)",
]

const OTHER_THRESHOLD = 0.05

export function aggregateByCategory(
  transactions: Array<Transaction>,
  categories: Array<Category>,
): Array<CategorySpending> {
  const categoryMap = new Map(categories.map((c) => [c.id, c]))

  // Only count expenses, exclude transfers and reimbursements
  const expenses = transactions.filter(
    (t) => t.type === "expense" && !t.transferId && !t.reimbursementId,
  )

  if (expenses.length === 0) return []

  // Sum by category
  const totals = new Map<string, number>()
  for (const tx of expenses) {
    const key = tx.categoryId ?? "uncategorized"
    totals.set(key, (totals.get(key) ?? 0) + tx.homeAmount)
  }

  const grandTotal = Array.from(totals.values()).reduce((a, b) => a + b, 0)

  // Split into above-threshold and below-threshold
  const above: Array<{ id: string; total: number }> = []
  let otherTotal = 0

  for (const [id, total] of totals) {
    if (total / grandTotal >= OTHER_THRESHOLD) {
      above.push({ id, total })
    } else {
      otherTotal += total
    }
  }

  // Sort descending by total
  above.sort((a, b) => b.total - a.total)

  const result: Array<CategorySpending> = above.map((item, i) => {
    const cat = categoryMap.get(item.id)
    return {
      categoryId: item.id,
      categoryName:
        item.id === "uncategorized"
          ? "Uncategorized"
          : (cat?.name ?? "Unknown"),
      icon: cat?.icon ?? null,
      total: item.total,
      fill: CHART_COLORS[i % CHART_COLORS.length],
    }
  })

  if (otherTotal > 0) {
    result.push({
      categoryId: "other",
      categoryName: "Other",
      icon: null,
      total: otherTotal,
      fill: CHART_COLORS[result.length % CHART_COLORS.length],
    })
  }

  return result
}
