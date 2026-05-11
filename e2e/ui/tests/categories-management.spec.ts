import { test, expect, type Page } from "@playwright/test"
import { signupAndLoginViaPage } from "../../shared/factories"

function expensesSection(page: Page) {
  return page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Expenses" }) })
}

function parentRow(page: Page, name: string) {
  return page.locator(".rounded-lg.border").filter({ hasText: name })
}

test.describe("Categories management", () => {
  test.beforeEach(async ({ page }) => {
    await signupAndLoginViaPage(page)
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
  })

  test("creates a new parent category", async ({ page }) => {
    await page.goto("/categories")
    await page.waitForLoadState("networkidle")
    await expect(page.getByText("Food & Drinks")).toBeVisible({
      timeout: 10_000,
    })

    await expensesSection(page)
      .getByRole("button", { name: "Add Category" })
      .click()

    const dialog = page.getByRole("dialog")
    await dialog.getByPlaceholder("Category name").fill("Custom Category")
    await dialog.getByRole("button", { name: "Create" }).click()

    await expect(dialog).not.toBeVisible({ timeout: 5000 })
    await expect(page.getByText("Custom Category")).toBeVisible()
  })

  test("creates a subcategory via inline add", async ({ page }) => {
    await page.goto("/categories")
    await page.waitForLoadState("networkidle")
    await expect(page.getByText("Food & Drinks")).toBeVisible({
      timeout: 10_000,
    })

    // Expand the Food & Drinks parent row
    await parentRow(page, "Food & Drinks")
      .getByRole("button", { name: /Food & Drinks/ })
      .click()

    // "Add subcategory" appears inside the expanded content
    await parentRow(page, "Food & Drinks")
      .getByRole("button", { name: "Add subcategory" })
      .click()

    const dialog = page.getByRole("dialog")
    await dialog.getByPlaceholder("Category name").fill("Fast Food")
    await dialog.getByRole("button", { name: "Create" }).click()

    await expect(dialog).not.toBeVisible({ timeout: 5000 })
    await expect(page.getByText("Fast Food")).toBeVisible()
  })

  test("edits a parent category", async ({ page }) => {
    await page.goto("/categories")
    await page.waitForLoadState("networkidle")
    await expect(page.getByText("Food & Drinks")).toBeVisible({
      timeout: 10_000,
    })

    // Create a custom category to edit
    await expensesSection(page)
      .getByRole("button", { name: "Add Category" })
      .click()
    let dialog = page.getByRole("dialog")
    await dialog.getByPlaceholder("Category name").fill("To Rename")
    await dialog.getByRole("button", { name: "Create" }).click()
    await expect(dialog).not.toBeVisible({ timeout: 5000 })
    await expect(page.getByText("To Rename")).toBeVisible()

    // Open ⋯ menu on the row and click Edit
    const row = parentRow(page, "To Rename")
    await row.locator("[data-slot=dropdown-menu-trigger]").click()
    await page.getByRole("menuitem", { name: "Edit" }).click()

    dialog = page.getByRole("dialog")
    const nameInput = dialog.getByPlaceholder("Category name")
    await nameInput.clear()
    await nameInput.fill("Renamed Category")
    await dialog.getByRole("button", { name: "Save" }).click()

    await expect(dialog).not.toBeVisible({ timeout: 5000 })
    await expect(page.getByText("Renamed Category")).toBeVisible()
  })

  test("deletes a parent category", async ({ page }) => {
    await page.goto("/categories")
    await page.waitForLoadState("networkidle")
    await expect(page.getByText("Food & Drinks")).toBeVisible({
      timeout: 10_000,
    })

    // Create a custom category to delete
    await expensesSection(page)
      .getByRole("button", { name: "Add Category" })
      .click()
    const dialog = page.getByRole("dialog")
    await dialog.getByPlaceholder("Category name").fill("Delete Me")
    await dialog.getByRole("button", { name: "Create" }).click()
    await expect(dialog).not.toBeVisible({ timeout: 5000 })
    await expect(page.getByText("Delete Me")).toBeVisible()

    // Open ⋯ menu and click Delete
    const row = parentRow(page, "Delete Me")
    await row.locator("[data-slot=dropdown-menu-trigger]").click()
    await page.getByRole("menuitem", { name: "Delete" }).click()

    // Confirm in alert dialog
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: /Delete|Deleting/ })
      .click()

    await expect(page.getByRole("alertdialog")).not.toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByText("Delete Me")).not.toBeVisible()
  })
})
