import type { Category, Transaction } from "@workspace/api-contract"
import { NEUTRAL_COLOR, categoryColor } from "@/lib/category-color"

export interface CategorySpending {
  categoryId: string
  categoryName: string
  icon: string | null
  total: number
  fill: string
}

const OTHER_THRESHOLD = 0.05

export function aggregateByCategory(
  transactions: Array<Transaction>,
  categories: Array<Category>
): Array<CategorySpending> {
  const categoryMap = new Map(categories.map((c) => [c.id, c]))

  const expenses = transactions.filter(
    (t) => t.type === "expense" && !t.transferId && !t.reimbursementId
  )

  if (expenses.length === 0) return []

  const totals = new Map<string, number>()
  for (const tx of expenses) {
    const key = tx.categoryId ?? "uncategorized"
    totals.set(key, (totals.get(key) ?? 0) + tx.homeAmount)
  }

  const grandTotal = Array.from(totals.values()).reduce((a, b) => a + b, 0)

  const above: Array<{ id: string; total: number }> = []
  let otherTotal = 0
  for (const [id, total] of totals) {
    if (total / grandTotal >= OTHER_THRESHOLD) {
      above.push({ id, total })
    } else {
      otherTotal += total
    }
  }

  above.sort((a, b) => b.total - a.total)

  const result: Array<CategorySpending> = above.map((item) => {
    const cat = categoryMap.get(item.id)
    const fill =
      item.id === "uncategorized" || !cat
        ? NEUTRAL_COLOR
        : categoryColor(cat, categories)
    return {
      categoryId: item.id,
      categoryName:
        item.id === "uncategorized"
          ? "Uncategorized"
          : (cat?.name ?? "Unknown"),
      icon: cat?.icon ?? null,
      total: item.total,
      fill,
    }
  })

  if (otherTotal > 0) {
    result.push({
      categoryId: "other",
      categoryName: "Other",
      icon: null,
      total: otherTotal,
      fill: NEUTRAL_COLOR,
    })
  }

  return result
}
