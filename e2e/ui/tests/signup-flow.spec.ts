import { test, expect } from "@playwright/test"
import { env } from "../../shared/env"
import { createUserData } from "../../shared/factories"

test.describe("Signup flow", () => {
  test("signs up and redirects to dashboard", async ({ page }) => {
    const user = createUserData()

    await page.goto("/signup")
    await page.waitForLoadState("networkidle")

    await page.getByLabel("Name").fill(user.name)
    await page.getByLabel("Email").fill(user.email)
    await page.getByLabel("Password").fill(user.password)
    await page.getByRole("button", { name: "Sign up" }).click()

    await expect(page).toHaveURL(/\/dashboard/)
  })

  test("shows error for duplicate email", async ({ page, request }) => {
    const user = createUserData()

    // Create user via API first
    await request.post(`${env.API_BASE_URL}/auth/signup`, { data: user })

    await page.goto("/signup")
    await page.waitForLoadState("networkidle")

    await page.getByLabel("Name").fill(user.name)
    await page.getByLabel("Email").fill(user.email)
    await page.getByLabel("Password").fill(user.password)
    await page.getByRole("button", { name: "Sign up" }).click()

    await expect(page.getByText("Email already in use")).toBeVisible()
  })

  test("shows validation error for invalid email", async ({ page }) => {
    await page.goto("/signup")
    await page.waitForLoadState("networkidle")

    await page.getByLabel("Name").fill("Test User")
    await page.getByLabel("Email").fill("not-an-email")
    await page.getByLabel("Password").fill("password123456")
    await page.getByRole("button", { name: "Sign up" }).click()

    // Browser native validation — type="email" rejects invalid format
    const emailInput = page.getByLabel("Email")
    const isInvalid = await emailInput.evaluate(
      (el: HTMLInputElement) => !el.validity.valid
    )
    expect(isInvalid).toBe(true)
  })

  test("shows validation for empty required fields", async ({ page }) => {
    await page.goto("/signup")
    await page.waitForLoadState("networkidle")

    await page.getByRole("button", { name: "Sign up" }).click()

    // HTML required attribute prevents submission
    const nameInput = page.getByLabel("Name")
    const isInvalid = await nameInput.evaluate(
      (el: HTMLInputElement) => !el.validity.valid
    )
    expect(isInvalid).toBe(true)
  })
})
