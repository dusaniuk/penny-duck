import { test, expect, type Locator } from "@playwright/test"
import { env } from "../../shared/env"
import {
  createAccountData,
  signupAndLoginViaPage,
} from "../../shared/factories"

// The category grid only shows the top ~7 children; the rest sit behind a
// "More categories" picker. Fall back to the picker (with search) when the
// chip isn't in the visible slice.
async function selectCategoryChip(dialog: Locator, name: string) {
  const chip = dialog.getByRole("button", { name, exact: true })
  if ((await chip.count()) > 0) {
    await chip.click()
    return
  }
  await dialog.getByRole("button", { name: "More categories" }).click()
  await dialog.getByPlaceholder("Search categories").fill(name)
  await dialog.getByRole("button", { name, exact: true }).click()
}

async function createAccountViaPage(
  page: any,
  overrides: Parameters<typeof createAccountData>[0] = {},
) {
  // Pin the type: the factory picks bank/brokerage at random, and
  // brokerage-account transactions are hidden from the transactions list
  const data = createAccountData({ type: "bank", ...overrides })
  const res = await page.request.post(`${env.WEB_BASE_URL}/api/accounts`, {
    data,
  })
  return res.json()
}

async function getFirstCategory(
  page: any,
  type: "expense" | "income" = "expense",
) {
  // Only leaf categories are selectable as a transaction category; parents
  // render in the picker as section headers. Create a parent + child of the
  // requested type and return the leaf.
  const parentRes = await page.request.post(
    `${env.WEB_BASE_URL}/api/categories`,
    { data: { name: `${type} parent`, type, color: "red" } },
  )
  const parent = await parentRes.json()
  const childRes = await page.request.post(
    `${env.WEB_BASE_URL}/api/categories`,
    { data: { name: `${type} leaf`, parentId: parent.id, icon: "cart" } },
  )
  return childRes.json()
}

test.describe("Transactions management", () => {
  test.beforeEach(async ({ page }) => {
    await signupAndLoginViaPage(page)
  })

  test("navigates to transactions page via sidebar", async ({ page }) => {
    await page.getByRole("link", { name: "Transactions" }).click()
    await expect(page).toHaveURL(/\/transactions/)
    await expect(
      page.getByRole("heading", { name: "Transactions" }),
    ).toBeVisible()
  })

  test("shows empty state when no transactions", async ({ page }) => {
    await page.goto("/transactions")
    await page.waitForLoadState("networkidle")

    await expect(page.getByText("No transactions yet")).toBeVisible()
  })

  test("creates an expense transaction via FAB", async ({
    page }) => {
    const account = await createAccountViaPage(page, {
      balance: 5000,
      currency: "USD",
    })
    const category = await getFirstCategory(page)

    await page.goto("/transactions")
    await page.waitForLoadState("networkidle")

    // Open FAB menu
    await page.getByRole("button", { name: "Add transaction" }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByRole("tab", { name: "Expense" }).click()
    await dialog.getByPlaceholder("0.00").first().fill("42.50")

    // Select account chip
    await dialog
      .getByRole("button", { name: new RegExp(account.name) })
      .click()

    // Select category chip in the grid
    await selectCategoryChip(dialog, category.name)

    await dialog.getByRole("button", { name: /^Create/ }).click()

    await expect(dialog).not.toBeVisible({ timeout: 5000 })
    await expect(page.getByText("−42.50").first()).toBeVisible()
  })

  test("creates an income transaction via FAB", async ({
    page }) => {
    const account = await createAccountViaPage(page, {
      balance: 0,
      currency: "UAH",
    })
    const category = await getFirstCategory(page, "income")

    await page.goto("/transactions")
    await page.waitForLoadState("networkidle")

    await page.getByRole("button", { name: "Add transaction" }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByRole("tab", { name: "Income" }).click()
    await dialog.getByPlaceholder("0.00").first().fill("1000")
    await dialog
      .getByRole("button", { name: new RegExp(account.name) })
      .click()
    await selectCategoryChip(dialog, category.name)

    await dialog.getByRole("button", { name: /^Create/ }).click()

    await expect(dialog).not.toBeVisible({ timeout: 5000 })
    await expect(page.getByText("+1,000.00").first()).toBeVisible()
  })

  test("creates an unsettled expense and settles it", async ({ page }) => {
    const account = await createAccountViaPage(page, {
      balance: 5000,
      currency: "USD",
    })
    const category = await getFirstCategory(page)

    await page.goto("/transactions")
    await page.waitForLoadState("networkidle")

    // Create unsettled expense
    await page.getByRole("button", { name: "Add transaction" }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByRole("tab", { name: "Expense" }).click()
    await dialog.getByPlaceholder("0.00").first().fill("100")
    await dialog
      .getByRole("button", { name: new RegExp(account.name) })
      .click()
    await selectCategoryChip(dialog, category.name)

    // Mark as unsettled — toggle button uses aria-label only (icon, no text).
    await dialog.getByRole("button", { name: "Mark unsettled" }).click()

    await dialog.getByRole("button", { name: /^Create/ }).click()
    await expect(dialog).not.toBeVisible({ timeout: 5000 })

    // Open row action menu and settle
    await page.getByTestId("transaction-actions").click()
    await page.getByRole("menuitem", { name: "Mark settled" }).click()
  })

  test("edits a transaction", async ({ page }) => {
    const account = await createAccountViaPage(page, {
      balance: 5000,
      currency: "USD",
    })
    const category = await getFirstCategory(page)

    await page.goto("/transactions")
    await page.waitForLoadState("networkidle")

    // Create a transaction first
    await page.getByRole("button", { name: "Add transaction" }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByRole("tab", { name: "Expense" }).click()
    await dialog.getByPlaceholder("0.00").first().fill("50")
    await dialog
      .getByRole("button", { name: new RegExp(account.name) })
      .click()
    await selectCategoryChip(dialog, category.name)
    await dialog.getByRole("button", { name: /^Create/ }).click()
    await expect(dialog).not.toBeVisible({ timeout: 5000 })

    // Open row action menu and click Edit
    await page.getByTestId("transaction-actions").click()
    await page.getByRole("menuitem", { name: "Edit" }).click()

    const editDialog = page.getByRole("dialog")
    await expect(editDialog.getByText("Edit expense")).toBeVisible()

    const amountInput = editDialog.getByPlaceholder("0.00").first()
    await amountInput.clear()
    await amountInput.fill("75")
    await editDialog.getByRole("button", { name: "Save changes" }).click()

    await expect(editDialog).not.toBeVisible({ timeout: 5000 })
    await expect(page.getByText("−75.00").first()).toBeVisible()
  })

  test("deletes a transaction", async ({ page }) => {
    const account = await createAccountViaPage(page, {
      balance: 5000,
      currency: "USD",
    })
    const category = await getFirstCategory(page)

    await page.goto("/transactions")
    await page.waitForLoadState("networkidle")

    // Create a transaction
    await page.getByRole("button", { name: "Add transaction" }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByRole("tab", { name: "Expense" }).click()
    await dialog.getByPlaceholder("0.00").first().fill("99.99")
    await dialog
      .getByRole("button", { name: new RegExp(account.name) })
      .click()
    await selectCategoryChip(dialog, category.name)
    await dialog.getByPlaceholder("Add a note…").fill("to delete")
    await dialog.getByRole("button", { name: /^Create/ }).click()
    await expect(dialog).not.toBeVisible({ timeout: 5000 })

    // Open row action menu and click Delete
    await page.getByTestId("transaction-actions").click()
    await page.getByRole("menuitem", { name: "Delete" }).click()

    // Confirm in alert dialog
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: /Delete|Deleting/ })
      .click()

    await expect(page.getByRole("alertdialog")).not.toBeVisible({
      timeout: 5000,
    })
    await expect(page.getByText("to delete")).not.toBeVisible()
  })
})

test.describe("Transfers", () => {
  test.beforeEach(async ({ page }) => {
    await signupAndLoginViaPage(page)
  })

  test("creates a same-currency transfer", async ({ page }) => {
    const acc1 = await createAccountViaPage(page, {
      balance: 5000,
      currency: "UAH",
      name: "UAH Source",
    })
    const acc2 = await createAccountViaPage(page, {
      balance: 0,
      currency: "UAH",
      name: "UAH Target",
    })

    await page.goto("/transactions")
    await page.waitForLoadState("networkidle")

    await page.getByRole("button", { name: "Add transaction" }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByRole("tab", { name: "Transfer" }).click()
    await dialog.getByPlaceholder("0.00").first().fill("500")

    // Transfer accounts are native <select> overlays with aria-labels.
    await dialog.getByLabel("From account").selectOption(acc1.id)
    await dialog.getByLabel("To account").selectOption(acc2.id)

    await dialog.getByRole("button", { name: /^Create/ }).click()
    await expect(dialog).not.toBeVisible({ timeout: 5000 })

    // Should show transfer with both account names
    await expect(page.getByText("Transfer").first()).toBeVisible()
    await expect(page.getByText(/UAH (Source|Target).*→.*UAH (Source|Target)/)).toBeVisible()
  })

  test("creates a cross-currency transfer with forced exchange rate", async ({
    page }) => {
    const usd = await createAccountViaPage(page, {
      balance: 1000,
      currency: "USD",
      name: "USD Acc",
    })
    const uah = await createAccountViaPage(page, {
      balance: 0,
      currency: "UAH",
      name: "UAH Acc",
    })

    await page.goto("/transactions")
    await page.waitForLoadState("networkidle")

    await page.getByRole("button", { name: "Add transaction" }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByRole("tab", { name: "Transfer" }).click()
    await dialog.getByPlaceholder("0.00").first().fill("100")

    await dialog.getByLabel("From account").selectOption(usd.id)
    await dialog.getByLabel("To account").selectOption(uah.id)

    // Exchange rate input is shown when currencies differ.
    const rate = dialog.getByLabel("Exchange rate")
    await rate.clear()
    await rate.fill("41.52")

    // Receive amount is rendered as text (not an input), formatted by <Amount>.
    await expect(dialog.getByText(/4[,. ]?152[.,]00\s+UAH/)).toBeVisible()

    await dialog.getByRole("button", { name: /^Create/ }).click()
    await expect(dialog).not.toBeVisible({ timeout: 5000 })

    await expect(page.getByText("100.00").first()).toBeVisible()
  })
})

test.describe("Transactions filters", () => {
  test.beforeEach(async ({ page }) => {
    await signupAndLoginViaPage(page)
  })

  test("filters by type via filter sheet", async ({ page }) => {
    const account = await createAccountViaPage(page, {
      balance: 5000,
      currency: "USD",
    })
    const category = await getFirstCategory(page)

    // Create an expense via API
    await page.request.post(`${env.WEB_BASE_URL}/api/transactions`, {
      data: {
        accountId: account.id,
        type: "expense",
        amount: 50,
        categoryId: category.id,
        date: new Date().toISOString(),
        note: "expense item",
      },
    })
    // Create an income via API
    await page.request.post(`${env.WEB_BASE_URL}/api/transactions`, {
      data: {
        accountId: account.id,
        type: "income",
        amount: 100,
        categoryId: category.id,
        date: new Date().toISOString(),
        note: "income item",
      },
    })

    await page.goto("/transactions")
    await page.waitForLoadState("networkidle")
    await expect(page.getByText("expense item")).toBeVisible()
    await expect(page.getByText("income item")).toBeVisible()

    // Open filter sheet
    await page.getByRole("button", { name: "Filters" }).click()

    // Select type = Expense
    const sheet = page.locator("[data-slot=sheet-content]")
    await sheet.getByRole("combobox").filter({ hasText: "All types" }).click()
    await page.getByRole("option", { name: "Expense" }).click()
    await sheet.getByRole("button", { name: "Apply" }).click()

    // Only expense should be visible
    await expect(page.getByText("expense item")).toBeVisible()
    await expect(page.getByText("income item")).not.toBeVisible()

    // Active filter badge should show
    await expect(page.getByText("Expense").first()).toBeVisible()
  })
})
