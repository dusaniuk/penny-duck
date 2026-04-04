import { test, expect } from "@playwright/test"
import { createUserData } from "../../shared/factories"

test.describe("POST /auth/login", () => {
  test("logs in with valid credentials and sets cookies", async ({
    request,
  }) => {
    const userData = createUserData()
    // Create user first
    await request.post("/auth/signup", { data: userData })

    const res = await request.post("/auth/login", {
      data: { email: userData.email, password: userData.password },
    })

    expect(res.status()).toBe(201)

    const body = await res.json()
    expect(body).toHaveProperty("id")
    expect(body.email).toBe(userData.email.toLowerCase())

    const cookies = res.headers()["set-cookie"]
    expect(cookies).toBeDefined()
    expect(cookies).toContain("access_token=")
    expect(cookies).toContain("refresh_token=")
  })

  test("returns 401 for wrong password", async ({ request }) => {
    const userData = createUserData()
    await request.post("/auth/signup", { data: userData })

    const res = await request.post("/auth/login", {
      data: { email: userData.email, password: "wrong-password" },
    })

    expect(res.status()).toBe(401)
  })

  test("returns 401 for non-existent email", async ({ request }) => {
    const res = await request.post("/auth/login", {
      data: { email: "nobody@example.com", password: "password123456" },
    })

    expect(res.status()).toBe(401)
  })

  test("returns 400 for missing fields", async ({ request }) => {
    const res = await request.post("/auth/login", {
      data: {},
    })

    expect(res.status()).toBe(400)
  })
})
