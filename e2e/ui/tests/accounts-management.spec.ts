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

    await page.getByLabel("Name").fill("Monobank UAH")
    // Type select - click trigger, then select option
    await page.getByRole("combobox").click()
    await page.getByRole("option", { name: "Bank" }).click()
    await page.getByLabel("Currency").fill("UAH")
    await page.getByLabel("Initial Balance").fill("25000")

    await page.getByRole("button", { name: "Create" }).click()

    // Dialog closes, card appears
    await expect(page.getByText("Monobank UAH")).toBeVisible()
    await expect(page.getByText("25,000.00")).toBeVisible()
  })

  test("edits an existing account", async ({ page }) => {
    await page.goto("/accounts")
    await page.waitForLoadState("networkidle")

    // Create an account first
    await page.getByRole("button", { name: "+ Add Account" }).click()
    await page.getByLabel("Name").fill("Test Account")
    await page.getByLabel("Currency").fill("PLN")
    await page.getByRole("button", { name: "Create" }).click()
    await expect(page.getByText("Test Account")).toBeVisible()

    // Open edit via ⋯ menu
    await page
      .locator("[data-slot=card]")
      .filter({ hasText: "Test Account" })
      .getByRole("button")
      .first()
      .click()
    await page.getByRole("menuitem", { name: "Edit" }).click()

    await page.getByLabel("Name").clear()
    await page.getByLabel("Name").fill("Renamed Account")
    await page.getByRole("button", { name: "Save" }).click()

    await expect(page.getByText("Renamed Account")).toBeVisible()
  })

  test("deletes an account", async ({ page }) => {
    await page.goto("/accounts")
    await page.waitForLoadState("networkidle")

    // Create an account first
    await page.getByRole("button", { name: "+ Add Account" }).click()
    await page.getByLabel("Name").fill("To Delete")
    await page.getByLabel("Currency").fill("USD")
    await page.getByRole("button", { name: "Create" }).click()
    await expect(page.getByText("To Delete")).toBeVisible()

    // Open delete via ⋯ menu
    await page
      .locator("[data-slot=card]")
      .filter({ hasText: "To Delete" })
      .getByRole("button")
      .first()
      .click()
    await page.getByRole("menuitem", { name: "Delete" }).click()

    // Confirm delete
    await page.getByRole("button", { name: "Delete" }).click()

    await expect(page.getByText("To Delete")).not.toBeVisible()
  })

  test("shows empty state with add card", async ({ page }) => {
    await page.goto("/accounts")
    await page.waitForLoadState("networkidle")

    await expect(
      page.getByRole("button", { name: "+ Add Account" })
    ).toBeVisible()
  })
})
