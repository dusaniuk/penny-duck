import { test, expect } from "@playwright/test"
import { createUserData } from "../../shared/factories"

test.describe("POST /auth/signup", () => {
  test("signs up with valid data and sets cookies", async ({ request }) => {
    const user = createUserData()

    const res = await request.post("/auth/signup", { data: user })

    expect(res.status()).toBe(201)

    const body = await res.json()
    expect(body).toHaveProperty("id")
    expect(body.email).toBe(user.email.toLowerCase())
    expect(body.name).toBe(user.name)

    const cookies = res.headers()["set-cookie"]
    expect(cookies).toBeDefined()
    expect(cookies).toContain("access_token=")
    expect(cookies).toContain("refresh_token=")
  })

  test("returns 409 for duplicate email", async ({ request }) => {
    const user = createUserData()

    // First signup
    await request.post("/auth/signup", { data: user })

    // Duplicate signup
    const res = await request.post("/auth/signup", {
      data: { ...user, name: "Different Name" },
    })

    expect(res.status()).toBe(409)
  })

  test("returns 400 for invalid email format", async ({ request }) => {
    const res = await request.post("/auth/signup", {
      data: {
        name: "Test User",
        email: "not-an-email",
        password: "password123456",
      },
    })

    expect(res.status()).toBe(400)
  })

  test("returns 400 for missing fields", async ({ request }) => {
    const res = await request.post("/auth/signup", {
      data: { email: "test@example.com" },
    })

    expect(res.status()).toBe(400)
  })
})
