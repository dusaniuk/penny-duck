import { test, expect, type Locator, type Page } from "@playwright/test"
import { signupAndLoginViaPage } from "../../shared/factories"

// Currency lives in a combobox whose search input only renders once the popover
// is open, so open the trigger first, then filter and pick via keyboard (the
// popover's pointer-event region overlaps the next field, so direct option
// clicks get intercepted).
async function selectCurrency(page: Page, code: string) {
  const dialog = page.getByRole("dialog")
  await dialog.getByText("Select currency").click()
  const search = page.getByPlaceholder("Search currency or code...")
  await search.fill(code)
  await page.keyboard.press("ArrowDown")
  await page.keyboard.press("Enter")
}

function accountCard(page: Page, name: string): Locator {
  return page.locator("[data-slot=card]").filter({ hasText: name })
}

// Card actions (Edit / Set default) live in a hover-revealed overlay on
// desktop. Hover the card to make them actionable before clicking.
async function openAccountEdit(page: Page, name: string): Promise<Locator> {
  const card = accountCard(page, name)
  await card.scrollIntoViewIfNeeded()
  await card.hover()
  await card.getByRole("button", { name: "Edit", exact: true }).click()
  return card
}

test.describe("Accounts management", () => {
  test.beforeEach(async ({ page }) => {
    await signupAndLoginViaPage(page)
  })

  test("navigates to accounts page via sidebar", async ({ page }) => {
    await page.getByRole("link", { name: "Accounts" }).click()
    await expect(page).toHaveURL(/\/accounts/)
    await expect(
      page.getByRole("heading", { name: "Where your money lives" })
    ).toBeVisible()
  })

  test("creates a new account", async ({ page }) => {
    await page.goto("/accounts")
    await page.waitForLoadState("networkidle")

    await page.getByRole("button", { name: "New account" }).click()

    const dialog = page.getByRole("dialog")
    await dialog.getByPlaceholder("e.g. Main Wallet").fill("Monobank UAH")
    await selectCurrency(page, "UAH")
    await dialog.getByPlaceholder("0.00").fill("25000")

    await dialog.getByRole("button", { name: "Create account" }).click()

    await expect(page.getByText("Monobank UAH")).toBeVisible()
    await expect(page.getByText(/25[,.]?000\.00/)).toBeVisible()
  })

  test("edits an existing account", async ({ page }) => {
    await page.goto("/accounts")
    await page.waitForLoadState("networkidle")

    await page.getByRole("button", { name: "New account" }).click()
    let dialog = page.getByRole("dialog")
    await dialog.getByPlaceholder("e.g. Main Wallet").fill("Test Account")
    await selectCurrency(page, "PLN")
    await dialog.getByRole("button", { name: "Create account" }).click()
    await expect(page.getByText("Test Account")).toBeVisible()

    // Open edit via the card's hover action
    await openAccountEdit(page, "Test Account")

    dialog = page.getByRole("dialog")
    const nameInput = dialog.getByPlaceholder("e.g. Main Wallet")
    await nameInput.clear()
    await nameInput.fill("Renamed Account")
    await dialog.getByRole("button", { name: "Save changes" }).click()

    await expect(page.getByText("Renamed Account")).toBeVisible()
  })

  test("deletes an account", async ({ page }) => {
    await page.goto("/accounts")
    await page.waitForLoadState("networkidle")

    await page.getByRole("button", { name: "New account" }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByPlaceholder("e.g. Main Wallet").fill("To Delete")
    await selectCurrency(page, "USD")
    await dialog.getByRole("button", { name: "Create account" }).click()
    await expect(page.getByText("To Delete")).toBeVisible()

    // The edit dialog's "Archive" opens a confirmation that also offers a hard
    // delete while the account has no transactions.
    await openAccountEdit(page, "To Delete")
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Archive" })
      .click()

    await page
      .getByRole("dialog")
      .getByRole("button", { name: /^Delete$|Deleting/ })
      .click()

    await expect(accountCard(page, "To Delete")).not.toBeVisible()
  })

  test("archives an account into the Archived group and unarchives it", async ({
    page,
  }) => {
    await page.goto("/accounts")
    await page.waitForLoadState("networkidle")

    await page.getByRole("button", { name: "New account" }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByPlaceholder("e.g. Main Wallet").fill("Old Bank")
    await selectCurrency(page, "EUR")
    await dialog.getByRole("button", { name: "Create account" }).click()
    await expect(accountCard(page, "Old Bank")).toBeVisible()

    await openAccountEdit(page, "Old Bank")
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Archive" })
      .click()
    await page
      .getByRole("dialog")
      .getByRole("button", { name: /^Archive$|Archiving/ })
      .click()

    // Gone from the Bank group, present behind the collapsed Archived header.
    await expect(page.getByRole("heading", { name: "Bank" })).not.toBeVisible()
    const archivedHeading = page.getByRole("heading", { name: "Archived" })
    await expect(archivedHeading).toBeVisible()
    await expect(accountCard(page, "Old Bank")).not.toBeVisible()

    await page.getByRole("button", { name: "Show" }).click()
    const card = accountCard(page, "Old Bank")
    await expect(card).toBeVisible()
    await expect(card.getByText(/archived/i)).toBeVisible()

    await card.hover()
    await card.getByRole("button", { name: "Unarchive" }).click()

    await expect(page.getByRole("heading", { name: "Bank" })).toBeVisible()
    await expect(archivedHeading).not.toBeVisible()
    await expect(accountCard(page, "Old Bank")).toBeVisible()
  })

  test("shows empty state with add card", async ({ page }) => {
    await page.goto("/accounts")
    await page.waitForLoadState("networkidle")

    await expect(
      page.getByRole("heading", { name: "Set up your first account" })
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Add your first account" })
    ).toBeVisible()
  })
})
