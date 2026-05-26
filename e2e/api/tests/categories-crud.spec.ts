import { test, expect } from "@playwright/test"
import { signupAndLogin } from "../../shared/factories"

async function createCategory(
  request: any,
  data: Record<string, unknown>,
): Promise<any> {
  const res = await request.post("/categories", { data })
  expect(res.status()).toBe(201)
  return res.json()
}

test.describe("Categories CRUD", () => {
  test.beforeEach(async ({ request }) => {
    await signupAndLogin(request)
  })

  test("starts with no categories after signup", async ({ request }) => {
    const res = await request.get("/categories")
    const categories = await res.json()
    expect(categories.length).toBe(0)
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
    const parent = await createCategory(request, {
      name: "Parent",
      color: "red",
    })

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
    const parent = await createCategory(request, {
      name: "Parent",
      color: "red",
    })
    const child = await createCategory(request, {
      name: "Child",
      parentId: parent.id,
    })

    const res = await request.post("/categories", {
      data: { name: "Too Deep", parentId: child.id },
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
    const category = await createCategory(request, {
      name: "Original",
      color: "red",
    })

    const res = await request.patch(`/categories/${category.id}`, {
      data: { name: "Renamed" },
    })

    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.name).toBe("Renamed")
  })

  test("updates a category icon", async ({ request }) => {
    const category = await createCategory(request, {
      name: "WithIcon",
      color: "red",
    })

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

test.describe("Categories seeding", () => {
  test.beforeEach(async ({ request }) => {
    await signupAndLogin(request)
  })

  test("seeds the default set into an empty org", async ({ request }) => {
    const res = await request.post("/categories/seed")
    expect(res.status()).toBe(201)

    const created = await res.json()
    expect(created.length).toBe(25)

    const topLevel = created.filter((c: any) => c.parentId === null)
    expect(topLevel.map((c: any) => c.name).sort()).toEqual([
      "Essentials",
      "Income",
      "Lifestyle",
      "Treats",
    ])

    const listed = await (await request.get("/categories")).json()
    expect(listed.length).toBe(25)
  })

  test("rejects seeding when categories already exist", async ({ request }) => {
    await request.post("/categories", {
      data: { name: "Existing", color: "red" },
    })

    const res = await request.post("/categories/seed")
    expect(res.status()).toBe(409)
  })
})

test.describe("Categories - auth required", () => {
  test("returns 401 without auth", async () => {
    const { env } = await import("../../shared/env")
    const res = await fetch(`${env.API_BASE_URL}/categories`)
    expect(res.status).toBe(401)
  })
})
