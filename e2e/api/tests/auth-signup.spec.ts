import { test, expect } from "@playwright/test"
import { createUserData } from "../../shared/factories"

test.describe("POST /auth/sign-up/email", () => {
  test("signs up, returns the user and a session cookie", async ({
    request,
  }) => {
    const user = createUserData()

    const res = await request.post("/auth/sign-up/email", { data: user })

    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(body.user.email).toBe(user.email.toLowerCase())
    expect(res.headers()["set-cookie"]).toContain("penny-duck.session_token=")
  })

  test("is signed in right after sign-up", async ({ request }) => {
    const user = createUserData()
    await request.post("/auth/sign-up/email", { data: user })

    const me = await request.get("/users/me")
    expect(me.status()).toBe(200)
  })

  test("returns 422 for a duplicate email", async ({ request }) => {
    const user = createUserData()
    await request.post("/auth/sign-up/email", { data: user })

    const res = await request.post("/auth/sign-up/email", {
      data: { ...user, name: "Different Name" },
    })

    expect(res.status()).toBe(422)
  })

  test("returns 400 for invalid email format", async ({ request }) => {
    const res = await request.post("/auth/sign-up/email", {
      data: {
        name: "Test User",
        email: "not-an-email",
        password: "password123456",
      },
    })
    expect(res.status()).toBe(400)
  })

  test("returns 400 for missing fields", async ({ request }) => {
    const res = await request.post("/auth/sign-up/email", {
      data: { email: "test@example.com" },
    })
    expect(res.status()).toBe(400)
  })
})
