import { test, expect } from "@playwright/test"
import { signupAndLogin } from "../../shared/factories"

test.describe("POST /auth/sign-out", () => {
  test("signs out and the session no longer works", async ({ request }) => {
    await signupAndLogin(request)
    expect((await request.get("/users/me")).status()).toBe(200)

    const res = await request.post("/auth/sign-out")
    expect(res.status()).toBe(200)

    expect((await request.get("/users/me")).status()).toBe(401)
  })
})
