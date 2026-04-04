import { test, expect } from "@playwright/test"
import { createUserData } from "../../shared/factories"

test.describe("Logout flow", () => {
  test("logs out and redirects to login", async ({ page }) => {
    const user = createUserData()

    // Sign up via browser
    await page.goto("/signup")
    await page.waitForLoadState("networkidle")
    await page.getByLabel("Name").fill(user.name)
    await page.getByLabel("Email").fill(user.email)
    await page.getByLabel("Password").fill(user.password)
    await page.getByRole("button", { name: "Sign up" }).click()
    await expect(page).toHaveURL(/\/dashboard/)

    // Open user dropdown in sidebar (click the button showing user's name)
    await page.getByRole("button", { name: user.name }).click()

    // Click "Log out" in the dropdown
    await page.getByRole("menuitem", { name: "Log out" }).click()

    await expect(page).toHaveURL(/\/login/)
  })

  test("cannot access dashboard after logout", async ({ page }) => {
    const user = createUserData()

    // Sign up via browser
    await page.goto("/signup")
    await page.waitForLoadState("networkidle")
    await page.getByLabel("Name").fill(user.name)
    await page.getByLabel("Email").fill(user.email)
    await page.getByLabel("Password").fill(user.password)
    await page.getByRole("button", { name: "Sign up" }).click()
    await expect(page).toHaveURL(/\/dashboard/)

    // Open user dropdown and logout
    await page.getByRole("button", { name: user.name }).click()
    await page.getByRole("menuitem", { name: "Log out" }).click()
    await expect(page).toHaveURL(/\/login/)

    // Try to visit dashboard
    await page.goto("/dashboard")
    await expect(page).toHaveURL(/\/login/)
  })
})
