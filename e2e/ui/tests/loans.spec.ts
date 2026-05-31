import { test, expect, type Page } from "@playwright/test"
import { env } from "../../shared/env"
import { createAccountData, signupAndLoginViaPage } from "../../shared/factories"

// Currency combobox opens on click; filter then pick via keyboard (pointer-event
// region overlaps next field on some viewport sizes).
async function selectCurrency(page: Page, code: string) {
  const dialog = page.getByRole("dialog")
  await dialog.getByText("Select currency").click()
  const search = page.getByPlaceholder("Search currency or code...")
  await search.fill(code)
  await page.keyboard.press("ArrowDown")
  await page.keyboard.press("Enter")
}

async function createAccountViaApi(
  page: Page,
  overrides: Parameters<typeof createAccountData>[0] = {},
) {
  const data = createAccountData(overrides)
  const res = await page.request.post(`${env.WEB_BASE_URL}/api/accounts`, {
    data,
  })
  return res.json()
}

test.describe("Loans", () => {
  test.beforeEach(async ({ page }) => {
    await signupAndLoginViaPage(page)
  })

  test("create loan, see liabilities in net worth, pay it down with a transfer", async ({
    page,
  }) => {
    // ── Seed: checking account via API ───────────────────────────────────────
    const checking = await createAccountViaApi(page, {
      name: "Checking",
      type: "bank",
      currency: "UAH",
      balance: 100000,
    })
    expect(checking.id).toBeTruthy()

    // ── Create loan via UI ────────────────────────────────────────────────────
    await page.goto("/accounts")
    await page.waitForLoadState("networkidle")

    // After the first account the empty-state hero is gone; "New account" button
    // appears in the page header.
    await page.getByRole("button", { name: "New account" }).click()

    const dialog = page.getByRole("dialog")

    // Set name
    await dialog.getByPlaceholder("e.g. Main Wallet").fill("Car loan")

    // Select "Loan" type from the Type dropdown (disambiguate from Currency combobox)
    await dialog.getByRole("combobox", { name: "Type" }).click()
    await page.getByRole("option", { name: /^Loan/ }).click()

    // Select UAH currency
    await selectCurrency(page, "UAH")

    // Fill the "How much do you owe?" field (label changes for loan type)
    await dialog.getByPlaceholder("0.00").fill("250000")

    await dialog.getByRole("button", { name: "Create account" }).click()
    await expect(
      page.getByRole("dialog", { name: "New account" })
    ).not.toBeVisible({ timeout: 10_000 })

    // Fetch the loan account ID from the API so we can select it by value in
    // the transfer form (the native <select> option label includes the balance,
    // making it unstable; selecting by ID is canonical).
    const accountsRes = await page.request.get(
      `${env.WEB_BASE_URL}/api/accounts`
    )
    const accountsList = await accountsRes.json() as Array<{ id: string; type: string; name: string }>
    const loanAccount = accountsList.find(
      (a) => a.type === "loan" && a.name === "Car loan"
    )
    expect(loanAccount).toBeTruthy()

    // ── Accounts page: Liabilities group should appear ────────────────────────
    await expect(
      page.getByRole("heading", { name: "Liabilities" })
    ).toBeVisible()

    // Loan card shows "Owed" framing — verify via the card container so the
    // assertion is not coupled to viewport-dependent visibility of the sub-text.
    const loanCard = page
      .locator("[data-slot=card]")
      .filter({ hasText: "Car loan" })
    await expect(loanCard).toBeVisible()
    await expect(loanCard).toContainText(/Owed/)

    // ── Net Worth card shows Assets − Liabilities formula ─────────────────────
    const netWorthCard = page.getByRole("region", {
      name: /summary/i,
    })
    // "Liabilities" section label (exact match to avoid matching "Assets − Liabilities")
    await expect(
      netWorthCard.getByText("Liabilities", { exact: true })
    ).toBeVisible()
    await expect(
      netWorthCard.getByText(/Assets − Liabilities/i)
    ).toBeVisible()

    // ── Transfer: pay 27,000 from Checking → Car loan ─────────────────────────
    await page.goto("/transactions")
    await page.waitForLoadState("networkidle")

    await page.getByRole("button", { name: "Add transaction" }).click()
    const txDialog = page.getByRole("dialog")
    await txDialog.getByRole("tab", { name: "Transfer" }).click()
    await txDialog.getByPlaceholder("0.00").first().fill("27000")

    // "From account" and "To account" are native <select> with aria-labels
    await txDialog.getByLabel("From account").selectOption(checking.id)
    await txDialog.getByLabel("To account").selectOption(loanAccount!.id)

    await txDialog.getByRole("button", { name: /^Create/ }).click()
    await expect(txDialog).not.toBeVisible({ timeout: 10_000 })

    // ── Loan balance dropped to -223,000 ──────────────────────────────────────
    // Navigate back to accounts to check the updated loan card balance.
    await page.goto("/accounts")
    await page.waitForLoadState("networkidle")

    // fmtMoney(-223000) → "-223,000.00" (en-US) or "-223 000,00" (uk locale)
    // Match the absolute numeric value with the "Owed" label present on the card.
    const updatedLoanCard = page
      .locator("[data-slot=card]")
      .filter({ hasText: "Car loan" })
    await expect(updatedLoanCard).toBeVisible()
    // The balance is rendered as fmtMoney(−223000) next to "UAH · Owed".
    // Accept any comma/dot/space number separator.
    await expect(updatedLoanCard).toContainText(/-\s?223[,\s.]?000/)
  })
})
