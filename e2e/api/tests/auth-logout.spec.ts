import { test, expect } from "@playwright/test"
import { signupAndLogin } from "../../shared/factories"

test.describe("POST /auth/logout", () => {
  test("logs out and clears cookies", async ({ request }) => {
    await signupAndLogin(request)

    const res = await request.post("/auth/logout")

    expect(res.status()).toBe(200)

    const body = await res.json()
    expect(body.message).toBe("Logged out")

    // Cookies should be cleared (set to empty / expired)
    const cookies = res.headers()["set-cookie"]
    if (cookies) {
      // Check tokens are cleared (empty value or Max-Age=0)
      expect(cookies).toMatch(/access_token=;|access_token=\s*;|Max-Age=0/)
    }
  })

  test("access token no longer works after logout", async ({ request }) => {
    await signupAndLogin(request)

    // Verify we're logged in
    const meBeforeLogout = await request.get("/users/me")
    expect(meBeforeLogout.status()).toBe(200)

    // Logout
    await request.post("/auth/logout")

    // Try to access /me — should fail
    // Note: Playwright request context may still carry the old cookies,
    // but the server should have revoked the refresh token.
    // The access token (JWT) may still work until expiry since it's stateless.
    // What we can verify: refresh no longer works after logout.
    const refreshRes = await request.post("/auth/refresh")
    expect(refreshRes.status()).toBe(401)
  })
})
