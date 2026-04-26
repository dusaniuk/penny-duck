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
    await card.getByRole("button").first().click()
    await page.getByRole("menuitem", { name: "Set as default" }).click()

    await expect(card.getByText("Default", { exact: true })).toBeVisible()

    await page.goto("/transactions")
    await page.waitForLoadState("networkidle")
    await page.locator(".fixed.bottom-6.right-6").click()
    const txDialog = page.getByRole("dialog")
    await expect(
      txDialog.locator("[data-slot=select-value]").filter({ hasText: target.name })
    ).toBeVisible()
  })
})
