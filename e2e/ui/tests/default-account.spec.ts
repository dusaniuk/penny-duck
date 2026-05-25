import { test, expect, type Page } from "@playwright/test"
import { env } from "../../shared/env"
import { createAccountData, signupAndLoginViaPage } from "../../shared/factories"

async function createAccountViaPage(
  page: Page,
  overrides: Parameters<typeof createAccountData>[0] = {},
) {
  const data = createAccountData(overrides)
  const res = await page.request.post(`${env.WEB_BASE_URL}/api/accounts`, {
    data,
  })
  return res.json()
}

test.describe("Default account", () => {
  test.beforeEach(async ({ page }) => {
    await signupAndLoginViaPage(page)
  })

  test("set as default preselects the account in new-transaction form", async ({
    page,
  }) => {
    await createAccountViaPage(page, {
      name: "Bank One",
      currency: "UAH",
      balance: 1000,
    })
    const target = await createAccountViaPage(page, {
      name: "Bank Two",
      currency: "UAH",
      balance: 2000,
    })

    await page.goto("/accounts")
    await page.waitForLoadState("networkidle")

    const card = page
      .locator("[data-slot=card]")
      .filter({ hasText: target.name })
    // "Set default" is a hover-revealed action on the card (desktop).
    await card.scrollIntoViewIfNeeded()
    await card.hover()
    await card.getByRole("button", { name: "Set default", exact: true }).click()

    // The card renders the badge in both mobile and desktop layouts; only the
    // desktop one is visible at this viewport.
    await expect(
      card.getByText("Default", { exact: true }).filter({ visible: true })
    ).toBeVisible()

    await page.goto("/transactions")
    await page.waitForLoadState("networkidle")
    await page.getByRole("button", { name: "Add transaction" }).click()
    const txDialog = page.getByRole("dialog")
    // The default account chip is pre-selected (aria-pressed=true).
    await expect(
      txDialog
        .locator('button[aria-pressed="true"]')
        .filter({ hasText: target.name }),
    ).toBeVisible()
  })
})
