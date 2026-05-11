import { test, expect, type Page } from "@playwright/test"
import { signupAndLoginViaPage } from "../../shared/factories"

// The currency combobox lives inside a Dialog and the popover's pointer-event
// region overlaps the next field's label, so direct clicks on options get
// intercepted. Selecting via keyboard avoids the hit-test conflict entirely.
async function selectCurrencyByKeyboard(page: Page, query: string) {
  const dialog = page.getByRole("dialog")
  await dialog.getByPlaceholder("Search currency...").fill(query)
  await page.keyboard.press("ArrowDown")
  await page.keyboard.press("Enter")
}

test.describe("Accounts management", () => {
  test.beforeEach(async ({ page }) => {
    await signupAndLoginViaPage(page)
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
    await selectCurrencyByKeyboard(page, "UAH")
    await dialog.getByPlaceholder("0.00").fill("25000")

    await dialog.getByRole("button", { name: "Create" }).click()

    await expect(page.getByText("Monobank UAH")).toBeVisible()
    await expect(page.getByText(/25[,.]?000\.00/)).toBeVisible()
  })

  test("edits an existing account", async ({ page }) => {
    await page.goto("/accounts")
    await page.waitForLoadState("networkidle")

    await page.getByRole("button", { name: "+ Add Account" }).click()
    let dialog = page.getByRole("dialog")
    await dialog.getByPlaceholder("e.g. Main Checking").fill("Test Account")
    await selectCurrencyByKeyboard(page, "PLN")
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

    await page.getByRole("button", { name: "+ Add Account" }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByPlaceholder("e.g. Main Checking").fill("To Delete")
    await selectCurrencyByKeyboard(page, "USD")
    await dialog.getByRole("button", { name: "Create" }).click()
    await expect(page.getByText("To Delete")).toBeVisible()

    // Open delete via ⋯ menu
    const card = page
      .locator("[data-slot=card]")
      .filter({ hasText: "To Delete" })
    await card.getByRole("button").first().click()
    await page.getByRole("menuitem", { name: "Delete" }).click()

    const deleteDialog = page.getByRole("dialog")
    await deleteDialog
      .getByRole("button", { name: /Delete|Deleting/ })
      .click()

    await expect(deleteDialog).not.toBeVisible({
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
