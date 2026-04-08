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
  })

  test("creates a new parent category", async ({ page }) => {
    await page.goto("/categories")
    await page.waitForLoadState("networkidle")
    await expect(page.getByText("Food & Drinks")).toBeVisible({
      timeout: 10_000,
    })

    await page.getByRole("button", { name: "Add Category" }).click()
    await page.getByPlaceholder("Category name").fill("Custom Category")
    // Click the save (checkmark) button
    await page.locator("button.text-green-500").click()

    await expect(page.getByText("Custom Category")).toBeVisible()
  })

  test("creates a subcategory via inline add", async ({ page }) => {
    await page.goto("/categories")
    await page.waitForLoadState("networkidle")
    await expect(page.getByText("Food & Drinks")).toBeVisible({
      timeout: 10_000,
    })

    // Expand Food & Drinks by clicking it
    await page.getByText("Food & Drinks").click()

    // Click "Add subcategory"
    await page.getByText("Add subcategory").first().click()
    await page.getByPlaceholder("Category name").fill("Fast Food")
    await page.locator("button.text-green-500").click()

    await expect(page.getByText("Fast Food")).toBeVisible()
  })

  test("edits a parent category", async ({ page }) => {
    await page.goto("/categories")
    await page.waitForLoadState("networkidle")
    await expect(page.getByText("Food & Drinks")).toBeVisible({
      timeout: 10_000,
    })

    // Create a custom category to edit
    await page.getByRole("button", { name: "Add Category" }).click()
    await page.getByPlaceholder("Category name").fill("To Rename")
    await page.locator("button.text-green-500").click()
    await expect(page.getByText("To Rename")).toBeVisible()

    // Open ⋯ menu on the row
    const row = page.locator(".rounded-lg.border").filter({ hasText: "To Rename" })
    await row.locator("[data-slot=dropdown-menu-trigger]").click()
    await page.getByRole("menuitem", { name: "Edit" }).click()

    // Edit inline
    const nameInput = page.getByPlaceholder("Category name")
    await nameInput.clear()
    await nameInput.fill("Renamed Category")
    await page.locator("button.text-green-500").click()

    await expect(page.getByText("Renamed Category")).toBeVisible()
  })

  test("deletes a parent category", async ({ page }) => {
    await page.goto("/categories")
    await page.waitForLoadState("networkidle")
    await expect(page.getByText("Food & Drinks")).toBeVisible({
      timeout: 10_000,
    })

    // Create a custom category to delete
    await page.getByRole("button", { name: "Add Category" }).click()
    await page.getByPlaceholder("Category name").fill("Delete Me")
    await page.locator("button.text-green-500").click()
    await expect(page.getByText("Delete Me")).toBeVisible()

    // Open ⋯ menu and delete
    const row = page.locator(".rounded-lg.border").filter({ hasText: "Delete Me" })
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
