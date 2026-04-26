import { test, expect, type Page } from "@playwright/test"
import { env } from "../../shared/env"
import { seedInstrument } from "../../shared/db"
import {
  createAccountData,
  signupAndLoginViaPage,
} from "../../shared/factories"

async function createBrokerageAccount(page: Page) {
  const data = createAccountData({
    name: "Test Brokerage",
    type: "brokerage",
    currency: "USD",
    balance: 10000,
  })
  const res = await page.request.post(`${env.WEB_BASE_URL}/api/accounts`, {
    data,
  })
  return res.json()
}

async function createTrade(
  page: Page,
  body: {
    accountId: string
    symbol: string
    type: "buy" | "sell" | "dividend"
    quantity?: number
    price?: number
    amount?: number
    date: string
  },
) {
  const res = await page.request.post(`${env.WEB_BASE_URL}/api/trades`, {
    data: body,
  })
  return res
}

test.describe("Investments", () => {
  test.beforeEach(async ({ page }) => {
    await signupAndLoginViaPage(page)
  })

  test("golden path: create brokerage, add buy trade, see position", async ({
    page,
  }) => {
    // Pre-seed AAPL so trade creation never hits Yahoo Finance.
    await seedInstrument({
      symbol: "AAPL",
      name: "Apple Inc.",
      exchange: "NMS",
      currency: "USD",
      lastPrice: 200,
    })

    const account = await createBrokerageAccount(page)

    // Visit the page with no trades yet.
    await page.goto("/investments")
    await page.waitForLoadState("networkidle")

    await expect(
      page.getByRole("heading", { name: "Investments" }),
    ).toBeVisible()
    await expect(page.getByRole("button", { name: "Add trade" })).toBeEnabled()
    await expect(
      page.getByText("No positions yet. Add a trade to get started."),
    ).toBeVisible()

    // Create the buy via API (bypasses InstrumentAutocomplete which otherwise
    // calls Yahoo search for queries unknown to the local cache).
    const res = await createTrade(page, {
      accountId: account.id,
      symbol: "AAPL",
      type: "buy",
      quantity: 10,
      price: 150,
      date: new Date().toISOString(),
    })
    expect(res.status()).toBe(201)

    // Reload so the positions query picks up the new trade.
    await page.goto("/investments")
    await page.waitForLoadState("networkidle")

    // AAPL row with qty 10 should be visible.
    const aaplRow = page.getByRole("row").filter({ hasText: "AAPL" })
    await expect(aaplRow).toBeVisible()
    await expect(aaplRow).toContainText("Apple Inc.")
    await expect(aaplRow).toContainText("10")

    // Seeded price 200 > cost 150 → unrealized gain is positive.
    // Row should show the gain (don't assert exact formatting — just presence).
    await expect(aaplRow).toContainText("%")
  })

  test("shows disabled Add trade button when no brokerage exists", async ({
    page,
  }) => {
    await page.goto("/investments")
    await page.waitForLoadState("networkidle")

    await expect(
      page.getByRole("heading", { name: "Investments" }),
    ).toBeVisible()
    await expect(page.getByRole("button", { name: "Add trade" })).toBeDisabled()
  })
})
