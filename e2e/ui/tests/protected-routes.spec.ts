import { test, expect } from "@playwright/test"
import { createUserData } from "../../shared/factories"

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
    const user = createUserData()

    // Sign up + login via browser to set cookies in browser context
    await page.goto("/signup")
    await page.waitForLoadState("networkidle")
    await page.getByLabel("Name").fill(user.name)
    await page.getByLabel("Email").fill(user.email)
    await page.getByLabel("Password").fill(user.password)
    await page.getByRole("button", { name: "Sign up" }).click()
    await expect(page).toHaveURL(/\/dashboard/)

    // Navigate to dashboard directly — should stay
    await page.goto("/dashboard")
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test("redirects authenticated user from /login to /dashboard", async ({
    page,
  }) => {
    const user = createUserData()

    // Sign up via browser
    await page.goto("/signup")
    await page.waitForLoadState("networkidle")
    await page.getByLabel("Name").fill(user.name)
    await page.getByLabel("Email").fill(user.email)
    await page.getByLabel("Password").fill(user.password)
    await page.getByRole("button", { name: "Sign up" }).click()
    await expect(page).toHaveURL(/\/dashboard/)

    // Now try to visit /login — should redirect back to /dashboard
    await page.goto("/login")
    await expect(page).toHaveURL(/\/dashboard/)
  })
})
