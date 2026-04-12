import { test, expect } from "@playwright/test"
import { signupAndLoginViaPage } from "../../shared/factories"

test.describe("Logout flow", () => {
  test("logs out and redirects to login", async ({ page }) => {
    const user = await signupAndLoginViaPage(page)

    // Open user dropdown in sidebar (click the button showing user's name)
    await page.getByRole("button", { name: user.name }).click()

    // Click "Log out" in the dropdown
    await page.getByRole("menuitem", { name: "Log out" }).click()

    await expect(page).toHaveURL(/\/login/)
  })

  test("cannot access dashboard after logout", async ({ page }) => {
    const user = await signupAndLoginViaPage(page)

    // Open user dropdown and logout
    await page.getByRole("button", { name: user.name }).click()
    await page.getByRole("menuitem", { name: "Log out" }).click()
    await expect(page).toHaveURL(/\/login/)

    // Try to visit dashboard
    await page.goto("/dashboard")
    await expect(page).toHaveURL(/\/login/)
  })
})
