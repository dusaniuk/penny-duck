import { test, expect, type Page } from "@playwright/test"
import { env } from "../../shared/env"
import { signupAndLoginViaPage } from "../../shared/factories"

async function seedTrip(page: Page) {
  const parentRes = await page.request.post(
    `${env.WEB_BASE_URL}/api/categories`,
    { data: { name: "Trips", type: "expense", color: "blue" } }
  )
  const parent = (await parentRes.json()) as { id: string }
  await page.request.post(`${env.WEB_BASE_URL}/api/categories`, {
    data: { name: "Warsaw 2026", parentId: parent.id, icon: "plane" },
  })
}

test.describe("Categories archiving", () => {
  test.beforeEach(async ({ page }) => {
    await signupAndLoginViaPage(page)
    await seedTrip(page)
    await page.goto("/categories")
    await page.waitForLoadState("networkidle")
    await expect(page.getByRole("heading", { name: "Trips" })).toBeVisible({
      timeout: 10_000,
    })
  })

  test("archives a subcategory into the parent's Archived group and restores it", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Archive Warsaw 2026" }).click()
    const dialog = page.getByRole("dialog")
    await expect(
      dialog.getByText(/stay categorized|no transactions/)
    ).toBeVisible()
    await dialog.getByRole("button", { name: /^Archive$|Archiving/ }).click()
    await expect(dialog).not.toBeVisible()

    // Hidden from the live grid, folded into the collapsed Archived group.
    await expect(
      page.getByRole("button", { name: "Archive Warsaw 2026" })
    ).not.toBeVisible()
    await page.getByRole("button", { name: "Show" }).click()

    await page.getByRole("button", { name: "Unarchive Warsaw 2026" }).click()
    await expect(
      page.getByRole("button", { name: "Archive Warsaw 2026" })
    ).toBeVisible()
    await expect(page.getByRole("button", { name: "Show" })).not.toBeVisible()
  })

  test("archives a parent into the sidebar's Archived group and restores it", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Archive Trips" }).click()
    const dialog = page.getByRole("dialog")
    await expect(dialog.getByText("1 subcategory")).toBeVisible()
    await dialog.getByRole("button", { name: /^Archive$|Archiving/ }).click()
    await expect(dialog).not.toBeVisible()

    // No live parents left: the sidebar offers only the collapsed group.
    const toggle = page.getByRole("button", { name: /^Archived/ })
    await expect(toggle).toBeVisible()
    await toggle.click()
    await page.getByRole("button", { name: /^Trips/ }).click()

    const heading = page.getByRole("heading", { name: /Trips/ })
    await expect(heading.getByText("Archived")).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Add subcategory" })
    ).not.toBeVisible()

    await page.getByRole("button", { name: "Unarchive", exact: true }).click()
    await expect(
      page.getByRole("button", { name: "Archive Trips" })
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: "Archive Warsaw 2026" })
    ).toBeVisible()
  })
})
