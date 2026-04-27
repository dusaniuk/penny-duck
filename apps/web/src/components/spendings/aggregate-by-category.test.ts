import { describe, expect, it } from "vitest"
import { aggregateByCategory } from "./aggregate-by-category"
import type { Category, Transaction } from "@workspace/api-contract"

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: crypto.randomUUID(),
    accountId: "acc-1",
    type: "expense",
    amount: 100,
    homeAmount: 100,
    categoryId: "cat-1",
    note: null,
    date: "2026-04-10T00:00:00.000Z",
    settled: true,
    originalAmount: null,
    originalCurrency: null,
    exchangeRate: null,
    transferId: null,
    reimbursementId: null,
    createdAt: "2026-04-10T00:00:00.000Z",
    updatedAt: "2026-04-10T00:00:00.000Z",
    madeBy: null,
    ...overrides,
  }
}

function makeCat(id: string, name: string): Category {
  return { id, name, type: "expense", parentId: null, icon: null }
}

const categories = [
  makeCat("cat-1", "Food"),
  makeCat("cat-2", "Transport"),
  makeCat("cat-3", "Entertainment"),
  makeCat("cat-4", "Shopping"),
  makeCat("cat-5", "Health"),
]

describe("aggregateByCategory", () => {
  it("groups expenses by category and sorts descending by total", () => {
    const transactions = [
      makeTx({ categoryId: "cat-1", homeAmount: 300 }),
      makeTx({ categoryId: "cat-1", homeAmount: 200 }),
      makeTx({ categoryId: "cat-2", homeAmount: 100 }),
    ]

    const result = aggregateByCategory(transactions, categories)

    expect(result).toEqual([
      {
        categoryId: "cat-1",
        categoryName: "Food",
        icon: null,
        total: 500,
        fill: "var(--color-chart-1)",
      },
      {
        categoryId: "cat-2",
        categoryName: "Transport",
        icon: null,
        total: 100,
        fill: "var(--color-chart-2)",
      },
    ])
  })

  it("excludes income, transfers, and reimbursements", () => {
    const transactions = [
      makeTx({ categoryId: "cat-1", homeAmount: 500, type: "expense" }),
      makeTx({ categoryId: "cat-1", homeAmount: 200, type: "income" }),
      makeTx({ categoryId: "cat-2", homeAmount: 100, transferId: "tf-1" }),
      makeTx({
        categoryId: "cat-3",
        homeAmount: 50,
        reimbursementId: "re-1",
      }),
    ]

    const result = aggregateByCategory(transactions, categories)

    expect(result).toEqual([
      {
        categoryId: "cat-1",
        categoryName: "Food",
        icon: null,
        total: 500,
        fill: "var(--color-chart-1)",
      },
    ])
  })

  it("merges categories below 5% threshold into Other", () => {
    const transactions = [
      makeTx({ categoryId: "cat-1", homeAmount: 900 }),
      makeTx({ categoryId: "cat-2", homeAmount: 60 }),
      makeTx({ categoryId: "cat-3", homeAmount: 40 }),
    ]

    // Total = 1000. cat-2 = 6% (above), cat-3 = 4% (below threshold)
    const result = aggregateByCategory(transactions, categories)

    expect(result).toHaveLength(3)
    expect(result[0]).toMatchObject({ categoryName: "Food", total: 900 })
    expect(result[1]).toMatchObject({ categoryName: "Transport", total: 60 })
    expect(result[2]).toMatchObject({
      categoryId: "other",
      categoryName: "Other",
      total: 40,
    })
  })

  it("returns empty array for no expenses", () => {
    const result = aggregateByCategory([], categories)
    expect(result).toEqual([])
  })

  it("handles transactions with null categoryId as Uncategorized", () => {
    const transactions = [makeTx({ categoryId: null, homeAmount: 100 })]

    const result = aggregateByCategory(transactions, categories)

    expect(result).toEqual([
      {
        categoryId: "uncategorized",
        categoryName: "Uncategorized",
        icon: null,
        total: 100,
        fill: "var(--color-chart-1)",
      },
    ])
  })
})
