import { test, expect } from "@playwright/test"
import { env } from "../../shared/env"
import { createUserData, signupAndLoginViaPage } from "../../shared/factories"

test.describe("Signup flow", () => {
  test("signs up and lands on the dashboard", async ({ page }) => {
    await signupAndLoginViaPage(page)
  })

  test("shows an error for a duplicate email", async ({ page, request }) => {
    const user = createUserData()
    await request.post(`${env.API_BASE_URL}/auth/sign-up/email`, {
      data: user,
    })

    await page.goto("/signup")
    await page.waitForLoadState("networkidle")
    await page.getByLabel("Name").fill("Different Name")
    await page.getByLabel("Email").fill(user.email)
    await page.getByLabel("Password").fill(user.password)
    await page.getByRole("button", { name: "Sign up" }).click()

    await expect(
      page.getByText("An account with this email already exists")
    ).toBeVisible()
  })

  test("offers Google sign-up with the terms notice", async ({ page }) => {
    await page.goto("/signup")
    await expect(
      page.getByRole("button", { name: "Continue with Google" })
    ).toBeVisible()
    await expect(page.getByText(/agree to our/i)).toBeVisible()
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
