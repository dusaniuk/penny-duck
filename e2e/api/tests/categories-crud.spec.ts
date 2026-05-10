import { test, expect } from "@playwright/test"
import { signupAndLogin } from "../../shared/factories"

async function waitForCategories(
  request: any,
  expectedCount: number,
  maxRetries = 10,
): Promise<any[]> {
  for (let i = 0; i < maxRetries; i++) {
    const res = await request.get("/categories")
    const body = await res.json()
    if (body.length >= expectedCount) return body
    await new Promise((r) => setTimeout(r, 200))
  }
  const res = await request.get("/categories")
  return res.json()
}

test.describe("Categories CRUD", () => {
  test.beforeEach(async ({ request }) => {
    await signupAndLogin(request)
  })

  test("lists default seeded categories after signup", async ({ request }) => {
    // Wait for async seeding to complete
    const categories = await waitForCategories(request, 28)
    expect(categories.length).toBe(28)
  })

  test("seeded categories have correct hierarchy", async ({ request }) => {
    const categories = await waitForCategories(request, 28)

    const parents = categories.filter(
      (c: { parentId: string | null }) => c.parentId === null
    )
    const children = categories.filter(
      (c: { parentId: string | null }) => c.parentId !== null
    )

    expect(parents.length).toBe(7)
    expect(children.length).toBe(21)

    // Every child's parentId should be a valid parent
    const parentIds = new Set(parents.map((p: { id: string }) => p.id))
    for (const child of children) {
      expect(parentIds.has(child.parentId)).toBe(true)
    }
  })

  test("creates a top-level category", async ({ request }) => {
    const res = await request.post("/categories", {
      data: { name: "Custom Category", color: "red" },
    })

    expect(res.status()).toBe(201)
    const body = await res.json()
    expect(body).toHaveProperty("id")
    expect(body.name).toBe("Custom Category")
    expect(body.parentId).toBeNull()
  })

  test("creates a subcategory", async ({ request }) => {
    const categories = await waitForCategories(request, 28)
    const parent = categories.find(
      (c: { parentId: string | null }) => c.parentId === null
    )

    const res = await request.post("/categories", {
      data: { name: "My Subcategory", parentId: parent.id },
    })

    expect(res.status()).toBe(201)
    const body = await res.json()
    expect(body.parentId).toBe(parent.id)
  })

  test("rejects subcategory under a subcategory (max depth)", async ({
    request,
  }) => {
    const categories = await waitForCategories(request, 28)
    const subcategory = categories.find(
      (c: { parentId: string | null }) => c.parentId !== null
    )

    const res = await request.post("/categories", {
      data: { name: "Too Deep", parentId: subcategory.id },
    })

    expect(res.status()).toBe(400)
  })

  test("rejects invalid parentId", async ({ request }) => {
    const res = await request.post("/categories", {
      data: {
        name: "Orphan",
        parentId: "00000000-0000-0000-0000-000000000000",
      },
    })

    expect(res.status()).toBe(400)
  })

  test("updates a category name", async ({ request }) => {
    const listRes = await request.get("/categories")
    const categories = await listRes.json()
    const category = categories[0]

    const res = await request.patch(`/categories/${category.id}`, {
      data: { name: "Renamed" },
    })

    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.name).toBe("Renamed")
  })

  test("updates a category icon", async ({ request }) => {
    const listRes = await request.get("/categories")
    const categories = await listRes.json()
    const category = categories[0]

    const res = await request.patch(`/categories/${category.id}`, {
      data: { icon: "star" },
    })

    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.icon).toBe("star")
  })

  test("deletes a category", async ({ request }) => {
    const createRes = await request.post("/categories", {
      data: { name: "To Delete", color: "red" },
    })
    const { id } = await createRes.json()

    const deleteRes = await request.delete(`/categories/${id}`)
    expect(deleteRes.status()).toBe(200)
  })

  test("deleting parent cascades subcategories", async ({ request }) => {
    // Wait for seeding to complete first
    await waitForCategories(request, 28)

    // Create parent
    const parentRes = await request.post("/categories", {
      data: { name: "Parent To Delete", color: "red" },
    })
    const parent = await parentRes.json()

    // Create subcategory
    await request.post("/categories", {
      data: { name: "Child To Delete", parentId: parent.id },
    })

    // Count before
    const beforeRes = await request.get("/categories")
    const beforeCount = (await beforeRes.json()).length

    // Delete parent
    await request.delete(`/categories/${parent.id}`)

    // Count after — should be 2 less (parent + child)
    const afterRes = await request.get("/categories")
    const afterCount = (await afterRes.json()).length
    expect(afterCount).toBe(beforeCount - 2)
  })

  test("returns 404 for non-existent category", async ({ request }) => {
    const res = await request.patch(
      "/categories/00000000-0000-0000-0000-000000000000",
      { data: { name: "Nope" } }
    )
    expect(res.status()).toBe(404)
  })
})

test.describe("Categories - auth required", () => {
  test("returns 401 without auth", async () => {
    const { env } = await import("../../shared/env")
    const res = await fetch(`${env.API_BASE_URL}/categories`)
    expect(res.status).toBe(401)
  })
})
