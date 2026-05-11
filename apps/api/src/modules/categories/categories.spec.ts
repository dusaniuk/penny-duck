import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  it,
  expect,
} from "bun:test"
import { env } from "@workspace/env/api"
import type { Category } from "@workspace/api-contract"
import { honoApp } from "@/app"
import { signAccessToken } from "@/modules/auth/core/jwt"
import { ACCESS_TOKEN_COOKIE } from "@/modules/auth/core/cookies"
import {
  closeTestApp,
  createTestApp,
  signupUser,
  truncateAll,
} from "@/test/setup"

let cookie: string

function cookieHeader(jwt: string): string {
  return `${ACCESS_TOKEN_COOKIE}=${jwt}`
}

beforeAll(async () => {
  await createTestApp()
})

afterAll(() => closeTestApp())

beforeEach(async () => {
  await truncateAll()
  const result = await signupUser()
  const jwt = signAccessToken(
    result.accessToken,
    env.JWT_SECRET,
    env.JWT_EXPIRATION,
  )
  cookie = cookieHeader(jwt)
})

async function listCategoriesHttp(): Promise<Category[]> {
  const res = await honoApp.request("/categories", { headers: { cookie } })
  expect(res.status).toBe(200)
  return res.json()
}

async function createCategoryHttp(
  body: Record<string, unknown>,
  expectedStatus = 201,
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
  expectedStatus = 200,
): Promise<Category> {
  const res = await honoApp.request(`/categories/${id}`, {
    method: "PATCH",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify(body),
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
  it("seeds default categories on signup", async () => {
    const categories = await listCategoriesHttp()
    expect(categories.length).toBeGreaterThan(0)
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
      { method: "DELETE", headers: { cookie } },
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
      (c) => c.name === "IncomeParent",
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
    const otherJwt = signAccessToken(
      other.accessToken,
      env.JWT_SECRET,
      env.JWT_EXPIRATION,
    )
    const otherCookie = cookieHeader(otherJwt)

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
