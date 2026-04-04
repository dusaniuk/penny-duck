import { test, expect } from "@playwright/test"
import { createUserData } from "../../shared/factories"

test.describe("Accounts management", () => {
  test.beforeEach(async ({ page }) => {
    const user = createUserData()

    await page.goto("/signup")
    await page.waitForLoadState("networkidle")
    await page.getByLabel("Name").fill(user.name)
    await page.getByLabel("Email").fill(user.email)
    await page.getByLabel("Password").fill(user.password)
    await page.getByRole("button", { name: "Sign up" }).click()
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test("navigates to accounts page via sidebar", async ({ page }) => {
    await page.getByRole("link", { name: "Accounts" }).click()
    await expect(page).toHaveURL(/\/accounts/)
    await expect(page.getByRole("heading", { name: "Accounts" })).toBeVisible()
  })

  test("creates a new account", async ({ page }) => {
    await page.goto("/accounts")
    await page.waitForLoadState("networkidle")

    await page.getByRole("button", { name: "+ Add Account" }).click()

    const dialog = page.getByRole("dialog")
    await dialog.getByPlaceholder("e.g. Main Checking").fill("Monobank UAH")
    await dialog.getByPlaceholder("USD").fill("UAH")
    await dialog.getByPlaceholder("0.00").fill("25000")

    await dialog.getByRole("button", { name: "Create" }).click()

    await expect(page.getByText("Monobank UAH")).toBeVisible()
    // Balance may or may not have comma formatting depending on locale
    await expect(page.getByText(/25[,.]?000\.00/)).toBeVisible()
  })

  test("edits an existing account", async ({ page }) => {
    await page.goto("/accounts")
    await page.waitForLoadState("networkidle")

    // Create an account first
    await page.getByRole("button", { name: "+ Add Account" }).click()
    let dialog = page.getByRole("dialog")
    await dialog.getByPlaceholder("e.g. Main Checking").fill("Test Account")
    await dialog.getByPlaceholder("USD").fill("PLN")
    await dialog.getByRole("button", { name: "Create" }).click()
    await expect(page.getByText("Test Account")).toBeVisible()

    // Open edit via ⋯ menu
    const card = page
      .locator("[data-slot=card]")
      .filter({ hasText: "Test Account" })
    await card.getByRole("button").first().click()
    await page.getByRole("menuitem", { name: "Edit" }).click()

    dialog = page.getByRole("dialog")
    const nameInput = dialog.getByPlaceholder("e.g. Main Checking")
    await nameInput.clear()
    await nameInput.fill("Renamed Account")
    await dialog.getByRole("button", { name: "Save Changes" }).click()

    await expect(page.getByText("Renamed Account")).toBeVisible()
  })

  test("deletes an account", async ({ page }) => {
    await page.goto("/accounts")
    await page.waitForLoadState("networkidle")

    // Create an account first
    await page.getByRole("button", { name: "+ Add Account" }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByPlaceholder("e.g. Main Checking").fill("To Delete")
    await dialog.getByPlaceholder("USD").fill("USD")
    await dialog.getByRole("button", { name: "Create" }).click()
    await expect(page.getByText("To Delete")).toBeVisible()

    // Open delete via ⋯ menu
    const card = page
      .locator("[data-slot=card]")
      .filter({ hasText: "To Delete" })
    await card.getByRole("button").first().click()
    await page.getByRole("menuitem", { name: "Delete" }).click()

    // Confirm delete in alert dialog
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: /Delete|Deleting/ })
      .click()

    // Wait for dialog to close and card to disappear
    await expect(page.getByRole("alertdialog")).not.toBeVisible({
      timeout: 10_000,
    })
    await expect(
      page.locator("[data-slot=card]").filter({ hasText: "To Delete" })
    ).not.toBeVisible()
  })

  test("shows empty state with add card", async ({ page }) => {
    await page.goto("/accounts")
    await page.waitForLoadState("networkidle")

    await expect(
      page.getByRole("button", { name: "+ Add Account" })
    ).toBeVisible()
  })
})
