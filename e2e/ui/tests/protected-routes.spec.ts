import { test, expect } from "@playwright/test"
import { signupAndLoginViaPage } from "../../shared/factories"

test.describe("Protected routes", () => {
  test("redirects unauthenticated user from /dashboard to /login", async ({
    page,
  }) => {
    await page.goto("/dashboard")

    await expect(page).toHaveURL(/\/login/)
  })

  test("allows authenticated user to access /dashboard", async ({
    page,
  }) => {
    await signupAndLoginViaPage(page)

    // Navigate to dashboard directly — should stay
    await page.goto("/dashboard")
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test("redirects authenticated user from /login to /dashboard", async ({
    page,
  }) => {
    await signupAndLoginViaPage(page)

    // Now try to visit /login — should redirect back to /dashboard
    await page.goto("/login")
    await expect(page).toHaveURL(/\/dashboard/)
  })
})
