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

    const parentRes = await page.request.post(
      `${env.WEB_BASE_URL}/api/categories`,
      {
        data: { name: `Wallet ${Date.now()}`, type: "expense", color: "red" },
      }
    )
    expect(parentRes.status()).toBe(201)
    const parent = await parentRes.json()

    const categoryName = `Taps ${Date.now()}`
    const categoryRes = await page.request.post(
      `${env.WEB_BASE_URL}/api/categories`,
      {
        data: { name: categoryName, type: "expense", parentId: parent.id },
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
    await expect(
      card.getByRole("button", { name: /^Account: Mono · UAH/ })
    ).toBeVisible()

    const fileViaPicker = async () => {
      await card.getByRole("button", { name: "More categories" }).click()
      const picker = page.getByRole("dialog", { name: "Select category" })
      await picker.getByPlaceholder("Search categories").fill(categoryName)
      await picker.getByRole("button", { name: categoryName }).click()
      await expect(picker).toHaveCount(0)
    }

    await fileViaPicker()
    await expect(card).toHaveCount(0)
    const toastMessage = page.getByText(`Silpo filed under ${categoryName}`)
    await expect(toastMessage).toBeVisible()

    await page.getByRole("button", { name: "Undo" }).click()
    await expect(page.getByText("Moved back to the inbox")).toBeVisible()
    await expect(card).toBeVisible()

    await fileViaPicker()
    await expect(card).toHaveCount(0)

    await page.goto("/transactions")
    await page.waitForLoadState("networkidle")
    await expect(page.getByText("Silpo").first()).toBeVisible()
  })
})
