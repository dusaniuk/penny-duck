import { test, expect } from "@playwright/test"
import { env } from "../../shared/env"
import { createUserData } from "../../shared/factories"

test.describe("POST /auth/sign-in/email", () => {
  test("signs in with valid credentials and sets a session cookie", async ({
    playwright,
  }) => {
    const userData = createUserData()
    const signupCtx = await playwright.request.newContext()
    await signupCtx.post(`${env.API_BASE_URL}/auth/sign-up/email`, {
      data: userData,
    })
    await signupCtx.dispose()

    const ctx = await playwright.request.newContext()
    const res = await ctx.post(`${env.API_BASE_URL}/auth/sign-in/email`, {
      data: { email: userData.email, password: userData.password },
    })

    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.user.email).toBe(userData.email.toLowerCase())
    expect(res.headers()["set-cookie"]).toContain("penny-duck.session_token=")
    await ctx.dispose()
  })

  test("returns 401 for wrong password", async ({ request }) => {
    const userData = createUserData()
    await request.post("/auth/sign-up/email", { data: userData })

    const res = await request.post("/auth/sign-in/email", {
      data: { email: userData.email, password: "wrong-password" },
    })

    expect(res.status()).toBe(401)
  })

  test("returns 401 for non-existent email", async ({ request }) => {
    const res = await request.post("/auth/sign-in/email", {
      data: { email: "nobody@example.com", password: "password123456" },
    })
    expect(res.status()).toBe(401)
  })

  test("returns 400 for missing fields", async ({ request }) => {
    const res = await request.post("/auth/sign-in/email", { data: {} })
    expect(res.status()).toBe(400)
  })
})
