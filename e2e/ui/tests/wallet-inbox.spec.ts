import { test, expect } from "@playwright/test"
import { env } from "../../shared/env"
import { signupAndLoginViaPage } from "../../shared/factories"

test.describe("Wallet inbox", () => {
  test("creates a key, captures a tap, and accepts it", async ({ page }) => {
    await signupAndLoginViaPage(page)

    const accountRes = await page.request.post(
      `${env.WEB_BASE_URL}/api/accounts`,
      {
        data: {
          type: "bank",
          name: "Mono",
          currency: "UAH",
          balance: 1000,
          cardLabel: "Mono Black",
        },
      }
    )
    expect(accountRes.status()).toBe(201)

    const categoryName = `Wallet ${Date.now()}`
    const categoryRes = await page.request.post(
      `${env.WEB_BASE_URL}/api/categories`,
      {
        data: { name: categoryName, type: "expense", color: "red" },
      }
    )
    expect(categoryRes.status()).toBe(201)

    await page.goto("/settings/shortcuts")
    await page.waitForLoadState("networkidle")
    await page.getByRole("button", { name: "Create key" }).click()
    const dialog = page.getByRole("dialog")
    await dialog.getByLabel("Name").fill("iPhone")
    await dialog.getByRole("button", { name: "Create", exact: true }).click()
    const key = await dialog.getByLabel("API key").inputValue()
    expect(key.startsWith("pd_")).toBe(true)
    await page.keyboard.press("Escape")
    await expect(page.getByText(/^iPhone/)).toBeVisible()

    const ingestRes = await page.request.post(
      `${env.WEB_BASE_URL}/api/inbox/wallet`,
      {
        headers: { "x-api-key": key },
        data: {
          card: "Mono Black",
          merchant: "Silpo",
          amount: 123.45,
          currency: "UAH",
          occurredAt: new Date().toISOString(),
        },
      }
    )
    expect(ingestRes.status()).toBe(201)

    await page.goto("/inbox")
    const card = page.getByTestId("inbox-item").filter({ hasText: "Silpo" })
    await expect(card).toBeVisible()
    await expect(card.getByRole("combobox", { name: "Account" })).toContainText(
      "Mono"
    )

    await card.getByRole("combobox", { name: "Category" }).click()
    await page.getByRole("option", { name: categoryName }).click()
    await card.getByRole("button", { name: "Accept" }).click()
    await expect(card).toHaveCount(0)

    await page.goto("/transactions")
    await page.waitForLoadState("networkidle")
    await expect(page.getByText("Silpo").first()).toBeVisible()
  })
})
