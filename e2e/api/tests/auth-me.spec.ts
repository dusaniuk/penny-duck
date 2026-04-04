import { test, expect } from "@playwright/test"
import { env } from "../../shared/env"
import { createUserData } from "../../shared/factories"

test.describe("GET /auth/me", () => {
  test("returns current user when authenticated", async ({ request }) => {
    const user = createUserData()
    await request.post("/auth/signup", { data: user })

    // The signup response sets cookies on the request context,
    // so subsequent requests carry them automatically
    const res = await request.get("/auth/me")

    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body).toHaveProperty("id")
    expect(body.email).toBe(user.email.toLowerCase())
    expect(body.name).toBe(user.name)
  })

  test("returns 401 without access token", async () => {
    const res = await fetch(`${env.API_BASE_URL}/auth/me`)
    expect(res.status).toBe(401)
  })
})
