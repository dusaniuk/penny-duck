import { test, expect } from "@playwright/test"
import { env } from "../../shared/env"
import { signupAndLogin } from "../../shared/factories"

test.describe("GET /users/me", () => {
  test("returns current user when authenticated", async ({ request }) => {
    const user = await signupAndLogin(request)

    const res = await request.get("/users/me")

    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body).toHaveProperty("id")
    expect(body.email).toBe(user.email.toLowerCase())
    expect(body.name).toBe(user.name)
  })

  test("returns 401 without access token", async () => {
    const res = await fetch(`${env.API_BASE_URL}/users/me`)
    expect(res.status).toBe(401)
  })
})
