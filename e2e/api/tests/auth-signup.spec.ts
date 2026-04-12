import { test, expect } from "@playwright/test"
import { createUserData } from "../../shared/factories"

test.describe("POST /auth/signup", () => {
  test("signs up with valid data and returns message", async ({ request }) => {
    const user = createUserData()

    const res = await request.post("/auth/signup", { data: user })

    expect(res.status()).toBe(201)

    const body = await res.json()
    expect(body).toHaveProperty("message")
  })

  test("can login after signup", async ({ request }) => {
    const user = createUserData()

    await request.post("/auth/signup", { data: user })

    const loginRes = await request.post("/auth/login", {
      data: { email: user.email, password: user.password },
    })

    expect(loginRes.status()).toBe(200)

    const cookies = loginRes.headers()["set-cookie"]
    expect(cookies).toBeDefined()
    expect(cookies).toContain("access_token=")
    expect(cookies).toContain("refresh_token=")
  })

  test("returns 201 for duplicate email (no error exposure)", async ({
    request,
  }) => {
    const user = createUserData()

    // First signup
    await request.post("/auth/signup", { data: user })

    // Duplicate signup — returns 201 to prevent email enumeration
    const res = await request.post("/auth/signup", {
      data: { ...user, name: "Different Name" },
    })

    expect(res.status()).toBe(201)
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
