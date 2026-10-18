import { describe, expect, it } from "vitest"
import { suggestAccounts, suggestCategories } from "./suggestions"
import type {
  Account,
  Category,
  CategoryUsageItem,
} from "@workspace/api-contract"

function category(id: string, name: string, parentId: string | null): Category {
  return {
    id,
    name,
    parentId,
    type: "expense",
    color: null,
    icon: null,
    archivedAt: null,
  }
}

function account(id: string, name: string, isDefault = false): Account {
  return {
    id,
    name,
    type: "bank",
    currency: "EUR",
    color: null,
    icon: null,
    balance: 0,
    homeBalance: 0,
    isDefault,
    walletId: null,
    cardLabel: null,
    archivedAt: null,
  }
}

function used(categoryId: string, count: number): CategoryUsageItem {
  return {
    categoryId,
    count,
    countThisMonth: 0,
    spentThisMonth: 0,
    lastActivityAt: null,
  }
}

const food = category("food", "Food", null)
const groceries = category("groceries", "Groceries", "food")
const coffee = category("coffee", "Coffee", "food")
const dining = category("dining", "Dining out", "food")
const taxi = category("taxi", "Taxi", "food")

describe("suggestCategories", () => {
  const all = [food, groceries, coffee, dining, taxi]

  it("returns the most used subcategories, never parents", () => {
    const usage = [used("taxi", 9), used("food", 50), used("coffee", 4)]
    expect(suggestCategories(all, usage, null, 2).map((c) => c.id)).toEqual([
      "taxi",
      "coffee",
    ])
  })

  it("breaks usage ties alphabetically", () => {
    expect(suggestCategories(all, [], null, 3).map((c) => c.id)).toEqual([
      "coffee",
      "dining",
      "groceries",
    ])
  })

  it("keeps the selected category visible when it ranks below the cut-off", () => {
    const usage = [used("taxi", 9), used("coffee", 4)]
    expect(
      suggestCategories(all, usage, "groceries", 2).map((c) => c.id)
    ).toEqual(["groceries", "taxi"])
  })
})

describe("suggestAccounts", () => {
  it("puts the default account first, then the most used", () => {
    const accounts = [
      account("a", "Alpha"),
      account("b", "Beta"),
      account("c", "Cash", true),
    ]
    const usage = [{ accountId: "b", count: 3 }]
    expect(suggestAccounts(accounts, usage, "", 3).map((a) => a.id)).toEqual([
      "c",
      "b",
      "a",
    ])
  })

  it("keeps the selected account visible when it ranks below the cut-off", () => {
    const accounts = [account("a", "Alpha"), account("b", "Beta")]
    expect(suggestAccounts(accounts, [], "b", 1).map((a) => a.id)).toEqual([
      "b",
    ])
  })
})
