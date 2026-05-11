import { test, expect, type Page } from "@playwright/test"
import { join } from "node:path"
import { env } from "../../shared/env"
import {
  createAccountData,
  signupAndLoginViaPage,
} from "../../shared/factories"
import { seedInstrument } from "../../shared/db"

const FIXTURES_DIR = join(
  __dirname,
  "..",
  "..",
  "..",
  "apps",
  "api",
  "src",
  "modules",
  "investments",
  "import",
  "fixtures",
)
const FIXTURE_TRADES_ONLY = join(FIXTURES_DIR, "trades-only.csv")
const FIXTURE_DIVIDENDS_ONLY = join(FIXTURES_DIR, "dividends-only.csv")

async function createBrokerage(page: Page) {
  const data = createAccountData({
    name: "IBKR",
    type: "brokerage",
    currency: "USD",
    balance: 10_000,
  })
  const res = await page.request.post(`${env.WEB_BASE_URL}/api/accounts`, {
    data,
  })
  return res.json()
}

test.describe("Investments · IBKR import", () => {
  test.beforeEach(async ({ page }) => {
    await signupAndLoginViaPage(page)
    await seedInstrument({
      symbol: "VOO",
      name: "Vanguard S&P 500",
      exchange: "NMS",
      currency: "USD",
      lastPrice: 500,
    })
  })

  test("upload, preview, commit", async ({ page }) => {
    await createBrokerage(page)
    await page.goto("/investments")
    await page.waitForLoadState("networkidle")

    await page.getByRole("button", { name: "Import from IBKR" }).click()
    await page
      .getByLabel("CSV file")
      .setInputFiles([FIXTURE_TRADES_ONLY, FIXTURE_DIVIDENDS_ONLY])
    await page.getByRole("button", { name: "Preview import" }).click()

    await expect(page.getByText("Trades found")).toBeVisible()
    await expect(
      page.getByRole("button", { name: /Import 1 trades, 1 dividends/ }),
    ).toBeEnabled()

    await page
      .getByRole("button", { name: /Import 1 trades, 1 dividends/ })
      .click()

    await expect(page.getByRole("row").filter({ hasText: "VOO" })).toBeVisible()
  })
})
