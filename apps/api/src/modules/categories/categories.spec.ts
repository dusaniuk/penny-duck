import { beforeAll, afterAll, beforeEach, describe, it, expect } from "bun:test"
import { exchangeRates, transactions } from "@workspace/db"
import type { Category } from "@workspace/api-contract"
import { honoApp } from "@/app"
import { db } from "@/db"
import { createAccount } from "@/modules/accounts/service"
import { createCategory, getCategoryUsage } from "@/modules/categories/service"
import {
  closeTestApp,
  createTestApp,
  signupUser,
  truncateAll,
} from "@/test/setup"

let cookie: string
let organizationId: string
let userId: string

beforeAll(async () => {
  await createTestApp()
})

afterAll(() => closeTestApp())

beforeEach(async () => {
  await truncateAll()
  const result = await signupUser()
  organizationId = result.organizationId
  userId = result.userId
  cookie = result.cookie
})

async function listCategoriesHttp(): Promise<Category[]> {
  const res = await honoApp.request("/categories", { headers: { cookie } })
  expect(res.status).toBe(200)
  return res.json()
}

async function createCategoryHttp(
  body: Record<string, unknown>,
  expectedStatus = 201
): Promise<Category> {
  const res = await honoApp.request("/categories", {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  expect(res.status).toBe(expectedStatus)
  return res.json()
}

async function updateCategoryHttp(
  id: string,
  body: Record<string, unknown>,
  expectedStatus = 200
): Promise<Category> {
  const res = await honoApp.request(`/categories/${id}`, {
    method: "PATCH",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  expect(res.status).toBe(expectedStatus)
  return res.json()
}

async function archiveCategoryHttp(
  id: string,
  expectedStatus = 200
): Promise<Category> {
  const res = await honoApp.request(`/categories/${id}/archive`, {
    method: "PUT",
    headers: { cookie },
  })
  expect(res.status).toBe(expectedStatus)
  return res.json()
}

async function unarchiveCategoryHttp(
  id: string,
  expectedStatus = 200
): Promise<Category> {
  const res = await honoApp.request(`/categories/${id}/archive`, {
    method: "DELETE",
    headers: { cookie },
  })
  expect(res.status).toBe(expectedStatus)
  return res.json()
}

describe("Categories — auth", () => {
  it("rejects unauthenticated list", async () => {
    const res = await honoApp.request("/categories")
    expect(res.status).toBe(401)
  })

  it("rejects unauthenticated create", async () => {
    const res = await honoApp.request("/categories", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "X", color: "red" }),
    })
    expect(res.status).toBe(401)
  })
})

describe("Categories", () => {
  it("starts with no categories after signup", async () => {
    const categories = await listCategoriesHttp()
    expect(categories.length).toBe(0)
  })

  it("creates a custom top-level category with a color", async () => {
    const category = await createCategoryHttp({
      name: "Custom Cat",
      icon: "star",
      type: "expense",
      color: "red",
    })

    expect(category.id).toBeDefined()
    expect(category.name).toBe("Custom Cat")
    expect(category.icon).toBe("star")
    expect(category.color).toBe("red")
  })

  it("rejects a top-level category created without a color", async () => {
    const res = await honoApp.request("/categories", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ name: "NoColor" }),
    })
    expect(res.status).toBe(400)
  })

  it("creates a subcategory with color = null", async () => {
    const parent = await createCategoryHttp({
      name: "Parent",
      type: "expense",
      color: "blue",
    })

    const child = await createCategoryHttp({
      name: "Child",
      parentId: parent.id,
    })

    expect(child.parentId).toBe(parent.id)
    expect(child.color).toBeNull()
  })

  it("rejects a subcategory created with a color", async () => {
    const parent = await createCategoryHttp({
      name: "Parent",
      type: "expense",
      color: "blue",
    })

    const res = await honoApp.request("/categories", {
      method: "POST",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({
        name: "Child",
        parentId: parent.id,
        color: "red",
      }),
    })
    expect(res.status).toBe(400)
  })

  it("updates a category's name and icon", async () => {
    const category = await createCategoryHttp({
      name: "Old Name",
      type: "expense",
      color: "blue",
    })

    const updated = await updateCategoryHttp(category.id, {
      name: "New Name",
      icon: "heart",
    })

    expect(updated.name).toBe("New Name")
    expect(updated.icon).toBe("heart")
  })

  it("updates a parent's color", async () => {
    const category = await createCategoryHttp({
      name: "Recolour",
      type: "expense",
      color: "red",
    })

    const updated = await updateCategoryHttp(category.id, { color: "blue" })

    expect(updated.color).toBe("blue")
  })

  it("clears color when a parent is demoted to child (sideways move)", async () => {
    const parentA = await createCategoryHttp({
      name: "Demoter",
      type: "expense",
      color: "red",
    })
    const parentB = await createCategoryHttp({
      name: "Target",
      type: "expense",
      color: "blue",
    })

    const moved = await updateCategoryHttp(parentA.id, { parentId: parentB.id })

    expect(moved.parentId).toBe(parentB.id)
    expect(moved.color).toBeNull()
  })

  it("rejects setting color on a child via update", async () => {
    const parent = await createCategoryHttp({
      name: "Parent",
      type: "expense",
      color: "red",
    })
    const child = await createCategoryHttp({
      name: "Child",
      parentId: parent.id,
    })

    const res = await honoApp.request(`/categories/${child.id}`, {
      method: "PATCH",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ color: "blue" }),
    })
    expect(res.status).toBe(400)
  })

  it("deletes a category", async () => {
    const category = await createCategoryHttp({
      name: "To Delete",
      type: "expense",
      color: "red",
    })

    const before = await listCategoriesHttp()
    const countBefore = before.length

    const delRes = await honoApp.request(`/categories/${category.id}`, {
      method: "DELETE",
      headers: { cookie },
    })
    expect(delRes.status).toBe(200)

    const after = await listCategoriesHttp()
    expect(after.length).toBe(countBefore - 1)
  })

  it("returns 404 when deleting an unknown category", async () => {
    const res = await honoApp.request(
      "/categories/00000000-0000-0000-0000-000000000000",
      { method: "DELETE", headers: { cookie } }
    )
    expect(res.status).toBe(404)
  })

  it("promotes a subcategory to top-level with a color", async () => {
    const parent = await createCategoryHttp({
      name: "Parent",
      type: "expense",
      color: "red",
    })
    const child = await createCategoryHttp({
      name: "Child",
      parentId: parent.id,
    })

    const promoted = await updateCategoryHttp(child.id, {
      parentId: null,
      color: "green",
    })

    expect(promoted.parentId).toBeNull()
    expect(promoted.color).toBe("green")

    const all = await listCategoriesHttp()
    const refetched = all.find((c) => c.id === child.id)
    expect(refetched?.parentId).toBeNull()
    expect(refetched?.color).toBe("green")
  })

  it("rejects promoting a subcategory without a color", async () => {
    const parent = await createCategoryHttp({
      name: "Parent",
      type: "expense",
      color: "red",
    })
    const child = await createCategoryHttp({
      name: "Child",
      parentId: parent.id,
    })

    const res = await honoApp.request(`/categories/${child.id}`, {
      method: "PATCH",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ parentId: null }),
    })
    expect(res.status).toBe(400)
  })

  it("rejects promoting a category that is already top-level", async () => {
    const parent = await createCategoryHttp({
      name: "AlreadyTop",
      type: "expense",
      color: "red",
    })

    const res = await honoApp.request(`/categories/${parent.id}`, {
      method: "PATCH",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ parentId: null, color: "blue" }),
    })
    expect(res.status).toBe(400)
  })

  it("reparents a subcategory between two same-type parents", async () => {
    const parentA = await createCategoryHttp({
      name: "ParentA",
      type: "expense",
      color: "red",
    })
    const parentB = await createCategoryHttp({
      name: "ParentB",
      type: "expense",
      color: "blue",
    })
    const child = await createCategoryHttp({
      name: "Child",
      parentId: parentA.id,
    })

    const moved = await updateCategoryHttp(child.id, { parentId: parentB.id })

    expect(moved.parentId).toBe(parentB.id)
  })

  it("rejects cross-type reparent", async () => {
    const expenseParent = await createCategoryHttp({
      name: "ExpenseParent",
      type: "expense",
      color: "red",
    })
    await createCategoryHttp({
      name: "IncomeParent",
      type: "income",
      color: "green",
    })
    const incomeParent = (await listCategoriesHttp()).find(
      (c) => c.name === "IncomeParent"
    )!
    const child = await createCategoryHttp({
      name: "Child",
      parentId: expenseParent.id,
    })

    const res = await honoApp.request(`/categories/${child.id}`, {
      method: "PATCH",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ parentId: incomeParent.id }),
    })
    expect(res.status).toBe(400)
  })

  it("rejects demoting a parent that has subcategories", async () => {
    const parentA = await createCategoryHttp({
      name: "ParentA",
      type: "expense",
      color: "red",
    })
    const parentB = await createCategoryHttp({
      name: "ParentB",
      type: "expense",
      color: "blue",
    })
    await createCategoryHttp({ name: "ChildOfA", parentId: parentA.id })

    const res = await honoApp.request(`/categories/${parentA.id}`, {
      method: "PATCH",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify({ parentId: parentB.id }),
    })
    expect(res.status).toBe(400)
  })

  it("isolates categories between users", async () => {
    await createCategoryHttp({
      name: "User1 Cat",
      type: "expense",
      color: "red",
    })

    const other = await signupUser()
    const otherCookie = other.cookie

    const otherCreate = await honoApp.request("/categories", {
      method: "POST",
      headers: { cookie: otherCookie, "content-type": "application/json" },
      body: JSON.stringify({
        name: "User2 Cat",
        type: "expense",
        color: "blue",
      }),
    })
    expect(otherCreate.status).toBe(201)

    const user1Cats = await listCategoriesHttp()
    const user2Res = await honoApp.request("/categories", {
      headers: { cookie: otherCookie },
    })
    const user2Cats = (await user2Res.json()) as Category[]

    expect(user1Cats.find((c) => c.name === "User1 Cat")).toBeDefined()
    expect(user2Cats.find((c) => c.name === "User2 Cat")).toBeDefined()
    expect(user1Cats.find((c) => c.name === "User2 Cat")).toBeUndefined()
    expect(user2Cats.find((c) => c.name === "User1 Cat")).toBeUndefined()
  })
})

describe("Categories — archiving", () => {
  async function tripsWithWarsaw() {
    const trips = await createCategoryHttp({
      name: "Trips",
      type: "expense",
      color: "blue",
    })
    const warsaw = await createCategoryHttp({
      name: "Warsaw 2026",
      parentId: trips.id,
    })
    return { trips, warsaw }
  }

  it("returns archivedAt null on a fresh category", async () => {
    const c = await createCategoryHttp({ name: "Food", color: "red" })
    expect(c.archivedAt).toBeNull()
  })

  it("archives a subcategory on its own and keeps the parent active", async () => {
    const { trips, warsaw } = await tripsWithWarsaw()

    const archived = await archiveCategoryHttp(warsaw.id)
    expect(archived.archivedAt).not.toBeNull()

    const list = await listCategoriesHttp()
    expect(list.find((c) => c.id === warsaw.id)!.archivedAt).not.toBeNull()
    expect(list.find((c) => c.id === trips.id)!.archivedAt).toBeNull()
  })

  it("archiving a parent archives its subcategories", async () => {
    const { trips, warsaw } = await tripsWithWarsaw()

    await archiveCategoryHttp(trips.id)

    const list = await listCategoriesHttp()
    expect(list.find((c) => c.id === trips.id)!.archivedAt).not.toBeNull()
    expect(list.find((c) => c.id === warsaw.id)!.archivedAt).not.toBeNull()
  })

  it("unarchiving a parent unarchives its subcategories", async () => {
    const { trips, warsaw } = await tripsWithWarsaw()
    await archiveCategoryHttp(trips.id)

    const restored = await unarchiveCategoryHttp(trips.id)
    expect(restored.archivedAt).toBeNull()

    const list = await listCategoriesHttp()
    expect(list.find((c) => c.id === warsaw.id)!.archivedAt).toBeNull()
  })

  it("unarchiving a subcategory also unarchives its parent", async () => {
    const { trips, warsaw } = await tripsWithWarsaw()
    await archiveCategoryHttp(trips.id)

    await unarchiveCategoryHttp(warsaw.id)

    const list = await listCategoriesHttp()
    expect(list.find((c) => c.id === warsaw.id)!.archivedAt).toBeNull()
    expect(list.find((c) => c.id === trips.id)!.archivedAt).toBeNull()
  })

  it("keeps transactions attached to an archived category", async () => {
    const { warsaw } = await tripsWithWarsaw()
    const account = await createAccount({
      organizationId,
      userId,
      name: "Bank",
      type: "bank",
      currency: "UAH",
    })
    await db.insert(transactions).values({
      organizationId,
      accountId: account.id,
      categoryId: warsaw.id,
      amount: -100,
      date: new Date(),
    })

    await archiveCategoryHttp(warsaw.id)

    const res = await honoApp.request(
      `/transactions?categoryId=${warsaw.id}&limit=1`,
      { headers: { cookie } }
    )
    expect(res.status).toBe(200)
    expect(((await res.json()) as { total: number }).total).toBe(1)
  })

  it("rejects archiving a category in another org", async () => {
    const c = await createCategoryHttp({ name: "Food", color: "red" })
    const other = await signupUser()
    const res = await honoApp.request(`/categories/${c.id}/archive`, {
      method: "PUT",
      headers: { cookie: other.cookie },
    })
    expect(res.status).toBe(404)
  })
})

describe("Categories — usage stats", () => {
  it("separates all-time count from current-month cash-flow stats", async () => {
    const bank = await createAccount({
      organizationId,
      userId,
      name: "Bank",
      type: "bank",
      currency: "UAH",
      balance: 0,
    })
    const brokerage = await createAccount({
      organizationId,
      userId,
      name: "IBKR",
      type: "brokerage",
      currency: "UAH",
      balance: 0,
    })
    const parent = await createCategory({
      organizationId,
      name: "Food",
      parentId: null,
      icon: null,
      type: "expense",
      color: "blue",
    })

    const now = new Date()
    const thisMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 15, 12, 0, 0)
    )
    const lastMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 15, 12, 0, 0)
    )

    // Two clean current-month expenses → counted everywhere.
    const [base] = await db
      .insert(transactions)
      .values([
        {
          organizationId,
          accountId: bank.id,
          categoryId: parent.id,
          amount: -50,
          date: thisMonth,
        },
        {
          organizationId,
          accountId: bank.id,
          categoryId: parent.id,
          amount: -30,
          date: thisMonth,
        },
      ])
      .returning()

    await db.insert(transactions).values([
      // Prior month → all-time count only.
      {
        organizationId,
        accountId: bank.id,
        categoryId: parent.id,
        amount: -20,
        date: lastMonth,
      },
      // Brokerage row → excluded from cash-flow, still in all-time count.
      {
        organizationId,
        accountId: brokerage.id,
        categoryId: parent.id,
        amount: -100,
        date: thisMonth,
      },
      // Reimbursement leg → excluded from cash-flow, still in all-time count.
      {
        organizationId,
        accountId: bank.id,
        categoryId: parent.id,
        amount: -40,
        date: thisMonth,
        reimbursementId: base.id,
      },
    ])

    const usage = await getCategoryUsage(organizationId, userId)
    const stat = usage.find((u) => u.categoryId === parent.id)

    expect(stat).toBeDefined()
    expect(stat!.count).toBe(5) // all categorized rows, no exclusions
    expect(stat!.countThisMonth).toBe(2) // brokerage + reimbursement + prior month excluded
    expect(stat!.spentThisMonth).toBe(80) // 50 + 30, account currency == home (UAH)
    expect(stat!.lastActivityAt).toBe(thisMonth.toISOString())
  })

  it("converts spend to the home currency using cached rates", async () => {
    // Home currency is UAH (signup default); spend on a USD account must be
    // converted, not summed as raw USD.
    const usd = await createAccount({
      organizationId,
      userId,
      name: "USD account",
      type: "bank",
      currency: "USD",
      balance: 0,
    })
    const parent = await createCategory({
      organizationId,
      name: "Travel",
      parentId: null,
      icon: null,
      type: "expense",
      color: "blue",
    })

    const now = new Date()
    const when = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 10, 12, 0, 0)
    )
    const dateStr = when.toISOString().split("T")[0]

    // Seed the cached USD->UAH rate so getRate resolves offline (no network).
    await db.insert(exchangeRates).values({
      date: dateStr,
      base: "USD",
      target: "UAH",
      rate: 40,
    })

    await db.insert(transactions).values({
      organizationId,
      accountId: usd.id,
      categoryId: parent.id,
      amount: -100,
      date: when,
    })

    const usage = await getCategoryUsage(organizationId, userId)
    const stat = usage.find((u) => u.categoryId === parent.id)

    expect(stat).toBeDefined()
    expect(stat!.spentThisMonth).toBe(4000) // 100 USD * 40 UAH/USD
  })
})
