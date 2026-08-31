import { test, expect } from "@playwright/test"
import { env } from "../../shared/env"
import {
  createAccountData,
  createTransactionData,
  signupAndLoginViaPage,
} from "../../shared/factories"

const PAGE_SIZE = 50
const TOTAL = 55

test.describe("Transactions pagination", () => {
  test("load more appends the next page without losing loaded rows", async ({
    page,
  }) => {
    test.setTimeout(120_000)
    await signupAndLoginViaPage(page)

    const accountRes = await page.request.post(
      `${env.WEB_BASE_URL}/api/accounts`,
      // type must be pinned: transactions on brokerage accounts are hidden
      // from the main list, and the factory picks bank/brokerage at random
      { data: createAccountData({ type: "bank", balance: 100000, currency: "UAH" }) }
    )
    const account = await accountRes.json()

    const parentRes = await page.request.post(
      `${env.WEB_BASE_URL}/api/categories`,
      { data: { name: "expense parent", type: "expense", color: "red" } }
    )
    const parent = await parentRes.json()
    const categoryRes = await page.request.post(
      `${env.WEB_BASE_URL}/api/categories`,
      { data: { name: "expense leaf", parentId: parent.id, icon: "cart" } }
    )
    const category = await categoryRes.json()

    // Distinct descending dates make page boundaries deterministic:
    // tx-1 is newest (page 1), tx-55 is oldest (page 2).
    const now = Date.now()
    for (let i = 1; i <= TOTAL; i++) {
      const res = await page.request.post(
        `${env.WEB_BASE_URL}/api/transactions`,
        {
          data: createTransactionData({
            accountId: account.id,
            categoryId: category.id,
            amount: 10,
            date: new Date(now - i * 86400000).toISOString(),
            note: `tx-${i}`,
          }),
        }
      )
      expect(res.ok()).toBe(true)
    }

    await page.goto("/transactions")
    await page.waitForLoadState("networkidle")

    await expect(page.getByText("tx-1", { exact: true })).toBeVisible()
    await expect(
      page.getByText(`tx-${PAGE_SIZE}`, { exact: true })
    ).toBeVisible()
    await expect(
      page.getByText(`tx-${PAGE_SIZE + 1}`, { exact: true })
    ).not.toBeVisible()

    await page.getByRole("button", { name: "Load more" }).click()
    await expect(page.getByText(`tx-${TOTAL}`, { exact: true })).toBeVisible()

    // First page must still be there after loading the second page
    await expect(page.getByText("tx-1", { exact: true })).toBeVisible()

    // Every transaction appears exactly once — no duplicated pages
    for (const i of [1, PAGE_SIZE, PAGE_SIZE + 1, TOTAL]) {
      await expect(page.getByText(`tx-${i}`, { exact: true })).toHaveCount(1)
    }

    // All rows loaded — the button should be gone
    await expect(
      page.getByRole("button", { name: "Load more" })
    ).not.toBeVisible()
  })
})
