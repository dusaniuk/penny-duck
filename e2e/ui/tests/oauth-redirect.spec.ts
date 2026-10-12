import { test, expect } from "@playwright/test"
import { env } from "../../shared/env"

test.describe("OAuth redirect through the web proxy", () => {
  test("passes the API callback redirect through unchanged", async ({
    request,
  }) => {
    const response = await request.get(
      `${env.WEB_BASE_URL}/api/auth/callback/google?error=access_denied`,
      { maxRedirects: 0 }
    )

    expect(response.status()).toBe(302)
    expect(response.headers()["location"]).toContain("/login?error=")
  })
})
