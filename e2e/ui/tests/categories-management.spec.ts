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

    // Wait for async seeding — check for a known parent category
    await expect(page.getByText("Food & Drinks")).toBeVisible({
      timeout: 10_000,
    })

    // Check some subcategories are visible as chips
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

    await page.getByLabel("Name").fill("Custom Category")
    await page.getByRole("button", { name: "Create" }).click()

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

    await page.getByLabel("Name").fill("Fast Food")
    await page.getByRole("button", { name: "Create" }).click()

    // New subcategory should appear as a chip
    await expect(page.getByText("Fast Food")).toBeVisible()
  })

  test("edits a parent category", async ({ page }) => {
    await page.goto("/categories")
    await page.waitForLoadState("networkidle")
    await expect(page.getByText("Food & Drinks")).toBeVisible({
      timeout: 10_000,
    })

    // Create a custom category to edit (don't edit seeded ones to avoid flaky tests)
    await page.getByRole("button", { name: "+ Add Category" }).click()
    await page.getByLabel("Name").fill("To Rename")
    await page.getByRole("button", { name: "Create" }).click()
    await expect(page.getByText("To Rename")).toBeVisible()

    // Open ⋯ menu on the card
    await page
      .locator("[data-slot=card]")
      .filter({ hasText: "To Rename" })
      .getByRole("button")
      .first()
      .click()
    await page.getByRole("menuitem", { name: "Edit" }).click()

    await page.getByLabel("Name").clear()
    await page.getByLabel("Name").fill("Renamed Category")
    await page.getByRole("button", { name: "Save" }).click()

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
    await page.getByLabel("Name").fill("Delete Me")
    await page.getByRole("button", { name: "Create" }).click()
    await expect(page.getByText("Delete Me")).toBeVisible()

    // Open ⋯ menu and delete
    await page
      .locator("[data-slot=card]")
      .filter({ hasText: "Delete Me" })
      .getByRole("button")
      .first()
      .click()
    await page.getByRole("menuitem", { name: "Delete" }).click()

    // Confirm
    await page.getByRole("button", { name: "Delete" }).click()

    await expect(page.getByText("Delete Me")).not.toBeVisible()
  })
})
