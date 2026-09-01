import { describe, it, expect, beforeAll, beforeEach, afterAll } from "bun:test"
import {
  closeTestApp,
  createTestApp,
  flushEvents,
  signupUser,
  truncateAll,
} from "@/test/setup"
import { createAccount } from "@/modules/accounts/service"
import {
  createTransaction,
  createTransfer,
} from "@/modules/transactions/service"
import { createCategory, deleteCategory } from "@/modules/categories/service"
import { getMonthlySummary, getSpendingByCategory } from "./service"

let organizationId: string
let userId: string

beforeAll(async () => {
  await createTestApp()
})

afterAll(() => closeTestApp())

beforeEach(async () => {
  await truncateAll()
  const result = await signupUser()
  organizationId = result.accessToken.organizationId
  userId = result.accessToken.sub
  await flushEvents()
})

describe("getMonthlySummary", () => {
  it("zero-fills months when no transactions exist", async () => {
    const result = await getMonthlySummary(organizationId, "UAH", 6)

    expect(result).toHaveLength(6)
    for (const item of result) {
      expect(item.income).toBe(0)
      expect(item.expenses).toBe(0)
      expect(item.month).toMatch(/^\d{4}-\d{2}$/)
    }
  })

  it("aggregates income and expenses for the current month", async () => {
    const account = await createAccount({
      organizationId,
      userId,
      name: "Bank",
      type: "bank",
      currency: "UAH",
      balance: 10000,
    })
    const category = await createCategory({
      organizationId,
      name: "Groceries",
      parentId: null,
      icon: "cart",
      type: "expense",
      color: "red",
    })
    const categoryId = category.id

    await createTransaction({
      organizationId,
      accountId: account.id,
      type: "expense",
      amount: 150,
      categoryId,
      date: new Date(),
      madeById: userId,
    })
    await createTransaction({
      organizationId,
      accountId: account.id,
      type: "income",
      amount: 500,
      categoryId,
      date: new Date(),
      madeById: userId,
    })

    const result = await getMonthlySummary(organizationId, "UAH", 6)
    const currentMonth = result[result.length - 1]
    expect(currentMonth.income).toBe(500)
    expect(currentMonth.expenses).toBe(150)
  })

  it("excludes transfers from the summary", async () => {
    const account1 = await createAccount({
      organizationId,
      userId,
      name: "Bank",
      type: "bank",
      currency: "UAH",
      balance: 10000,
    })
    const account2 = await createAccount({
      organizationId,
      userId,
      name: "Cash",
      type: "bank",
      currency: "UAH",
      balance: 0,
    })

    await createTransfer({
      organizationId,
      fromAccountId: account1.id,
      toAccountId: account2.id,
      amount: 200,
      date: new Date(),
      madeById: userId,
    })

    const result = await getMonthlySummary(organizationId, "UAH", 6)
    const currentMonth = result[result.length - 1]
    expect(currentMonth.income).toBe(0)
    expect(currentMonth.expenses).toBe(0)
  })

  it("returns the requested number of months", async () => {
    const result = await getMonthlySummary(organizationId, "UAH", 12)
    expect(result).toHaveLength(12)
  })
})

describe("getSpendingByCategory", () => {
  it("returns empty categories when no spending exists", async () => {
    const result = await getSpendingByCategory(organizationId, "UAH")

    expect(result.total).toBe(0)
    expect(result.categories).toHaveLength(0)
    expect(result.homeCurrency).toBe("UAH")
    expect(result.month).toMatch(/^\d{4}-\d{2}$/)
  })

  it("rolls subcategory spending up to the parent category", async () => {
    const account = await createAccount({
      organizationId,
      userId,
      name: "Bank",
      type: "bank",
      currency: "UAH",
      balance: 10000,
    })
    const parent = await createCategory({
      organizationId,
      name: "Food",
      parentId: null,
      icon: "cart",
      type: "expense",
      color: "orange",
    })
    const child = await createCategory({
      organizationId,
      name: "Groceries",
      parentId: parent.id,
      icon: "cart",
      type: "expense",
      color: null,
    })

    await createTransaction({
      organizationId,
      accountId: account.id,
      type: "expense",
      amount: 100,
      categoryId: parent.id,
      date: new Date(),
      madeById: userId,
    })
    await createTransaction({
      organizationId,
      accountId: account.id,
      type: "expense",
      amount: 50,
      categoryId: child.id,
      date: new Date(),
      madeById: userId,
    })

    const result = await getSpendingByCategory(organizationId, "UAH")

    expect(result.categories).toHaveLength(1)
    expect(result.categories[0].id).toBe(parent.id)
    expect(result.categories[0].name).toBe("Food")
    expect(result.categories[0].color).toBe("orange")
    expect(result.categories[0].amount).toBe(150)
    expect(result.total).toBe(150)
  })

  it("buckets orphaned spending as Uncategorized and sorts by amount descending", async () => {
    const account = await createAccount({
      organizationId,
      userId,
      name: "Bank",
      type: "bank",
      currency: "UAH",
      balance: 10000,
    })
    const category = await createCategory({
      organizationId,
      name: "Rent",
      parentId: null,
      icon: "home",
      type: "expense",
      color: "blue",
    })
    const doomed = await createCategory({
      organizationId,
      name: "Doomed",
      parentId: null,
      icon: "trash",
      type: "expense",
      color: "gray",
    })

    await createTransaction({
      organizationId,
      accountId: account.id,
      type: "expense",
      amount: 40,
      categoryId: category.id,
      date: new Date(),
      madeById: userId,
    })
    await createTransaction({
      organizationId,
      accountId: account.id,
      type: "expense",
      amount: 300,
      categoryId: doomed.id,
      date: new Date(),
      madeById: userId,
    })
    // Deleting the category sets category_id to null on its transactions
    await deleteCategory(doomed.id, organizationId)

    const result = await getSpendingByCategory(organizationId, "UAH")

    expect(result.categories).toHaveLength(2)
    expect(result.categories[0].id).toBeNull()
    expect(result.categories[0].name).toBe("Uncategorized")
    expect(result.categories[0].amount).toBe(300)
    expect(result.categories[1].name).toBe("Rent")
    expect(result.total).toBe(340)
  })

  it("excludes income and transfers", async () => {
    const account1 = await createAccount({
      organizationId,
      userId,
      name: "Bank",
      type: "bank",
      currency: "UAH",
      balance: 10000,
    })
    const account2 = await createAccount({
      organizationId,
      userId,
      name: "Cash",
      type: "bank",
      currency: "UAH",
      balance: 0,
    })

    const incomeCategory = await createCategory({
      organizationId,
      name: "Salary",
      parentId: null,
      icon: "cash",
      type: "income",
      color: "green",
    })
    await createTransaction({
      organizationId,
      accountId: account1.id,
      type: "income",
      amount: 500,
      categoryId: incomeCategory.id,
      date: new Date(),
      madeById: userId,
    })
    await createTransfer({
      organizationId,
      fromAccountId: account1.id,
      toAccountId: account2.id,
      amount: 200,
      date: new Date(),
      madeById: userId,
    })

    const result = await getSpendingByCategory(organizationId, "UAH")

    expect(result.total).toBe(0)
    expect(result.categories).toHaveLength(0)
  })
})
