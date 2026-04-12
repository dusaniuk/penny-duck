import { test, expect } from "@playwright/test"
import { env } from "../../shared/env"
import { signupAndLogin } from "../../shared/factories"

test.describe("POST /auth/refresh", () => {
  test("refreshes tokens with valid refresh token", async ({ request }) => {
    await signupAndLogin(request)

    // Login sets cookies; now call refresh
    const res = await request.post("/auth/refresh")

    expect(res.status()).toBe(200)

    const cookies = res.headers()["set-cookie"]
    expect(cookies).toBeDefined()
    expect(cookies).toContain("access_token=")
    expect(cookies).toContain("refresh_token=")
  })

  test("returns 401 without refresh token", async () => {
    const res = await fetch(`${env.API_BASE_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    })
    expect(res.status).toBe(401)
  })
})
