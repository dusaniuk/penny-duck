import { test, expect } from "@playwright/test"
import { createUserData } from "../../shared/factories"

test.describe("Categories management", () => {
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

  test("navigates to categories page via sidebar", async ({ page }) => {
    await page.getByRole("link", { name: "Categories" }).click()
    await expect(page).toHaveURL(/\/categories/)
    await expect(
      page.getByRole("heading", { name: "Categories" })
    ).toBeVisible()
  })

  test("shows seeded default categories after signup", async ({ page }) => {
    await page.goto("/categories")
    await page.waitForLoadState("networkidle")

    await expect(page.getByText("Food & Drinks")).toBeVisible({
      timeout: 10_000,
    })

    await expect(page.getByText("Groceries")).toBeVisible()
    await expect(page.getByText("Restaurants")).toBeVisible()
  })

  test("creates a new parent category", async ({ page }) => {
    await page.goto("/categories")
    await page.waitForLoadState("networkidle")
    await expect(page.getByText("Food & Drinks")).toBeVisible({
      timeout: 10_000,
    })

    await page.getByRole("button", { name: "+ Add Category" }).click()

    const dialog = page.getByRole("dialog")
    await dialog.getByPlaceholder("e.g. Food & Drink").fill("Custom Category")
    await dialog.getByRole("button", { name: "Create" }).click()

    await expect(page.getByText("Custom Category")).toBeVisible()
  })

  test("creates a subcategory via + add chip", async ({ page }) => {
    await page.goto("/categories")
    await page.waitForLoadState("networkidle")
    await expect(page.getByText("Food & Drinks")).toBeVisible({
      timeout: 10_000,
    })

    // Click the "+ add" chip inside the Food & Drinks card
    await page
      .locator("[data-slot=card]")
      .filter({ hasText: "Food & Drinks" })
      .getByText("add")
      .click()

    const dialog = page.getByRole("dialog")
    await dialog.getByPlaceholder("e.g. Food & Drink").fill("Fast Food")
    await dialog.getByRole("button", { name: "Create" }).click()

    await expect(page.getByText("Fast Food")).toBeVisible()
  })

  test("edits a parent category", async ({ page }) => {
    await page.goto("/categories")
    await page.waitForLoadState("networkidle")
    await expect(page.getByText("Food & Drinks")).toBeVisible({
      timeout: 10_000,
    })

    // Create a custom category to edit
    await page.getByRole("button", { name: "+ Add Category" }).click()
    let dialog = page.getByRole("dialog")
    await dialog.getByPlaceholder("e.g. Food & Drink").fill("To Rename")
    await dialog.getByRole("button", { name: "Create" }).click()
    await expect(page.getByText("To Rename")).toBeVisible()

    // Open ⋯ menu on the card
    const card = page
      .locator("[data-slot=card]")
      .filter({ hasText: "To Rename" })
    await card.getByRole("button").first().click()
    await page.getByRole("menuitem", { name: "Edit" }).click()

    dialog = page.getByRole("dialog")
    const nameInput = dialog.getByPlaceholder("e.g. Food & Drink")
    await nameInput.clear()
    await nameInput.fill("Renamed Category")
    await dialog.getByRole("button", { name: "Save Changes" }).click()

    await expect(page.getByText("Renamed Category")).toBeVisible()
  })

  test("deletes a parent category", async ({ page }) => {
    await page.goto("/categories")
    await page.waitForLoadState("networkidle")
    await expect(page.getByText("Food & Drinks")).toBeVisible({
      timeout: 10_000,
    })

    // Create a custom category to delete
    await page.getByRole("button", { name: "+ Add Category" }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByPlaceholder("e.g. Food & Drink").fill("Delete Me")
    await dialog.getByRole("button", { name: "Create" }).click()
    await expect(page.getByText("Delete Me")).toBeVisible()

    // Open ⋯ menu and delete
    const card = page
      .locator("[data-slot=card]")
      .filter({ hasText: "Delete Me" })
    await card.getByRole("button").first().click()
    await page.getByRole("menuitem", { name: "Delete" }).click()

    // Confirm in alert dialog
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: /Delete|Deleting/ })
      .click()

    // Wait for dialog to close and card to disappear
    await expect(page.getByRole("alertdialog")).not.toBeVisible({
      timeout: 10_000,
    })
    await expect(page.locator("[data-slot=card]").filter({ hasText: "Delete Me" })).not.toBeVisible()
  })
})
