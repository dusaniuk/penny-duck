import { test, expect } from "@playwright/test"
import { env } from "../../shared/env"
import { createUserData } from "../../shared/factories"

test.describe("Login flow", () => {
  test("logs in and redirects to dashboard", async ({ page, request }) => {
    const userData = createUserData()
    // Create user via API
    await request.post(`${env.API_BASE_URL}/auth/sign-up/email`, {
      data: userData,
    })

    await page.goto("/login")
    await page.waitForLoadState("networkidle")

    await page.getByLabel("Email").fill(userData.email)
    await page.getByLabel("Password").fill(userData.password)
    await page.getByRole("button", { name: "Login" }).click()

    await expect(page).toHaveURL(/\/dashboard/)
  })

  test("shows error for wrong password", async ({ page, request }) => {
    const userData = createUserData()
    await request.post(`${env.API_BASE_URL}/auth/sign-up/email`, {
      data: userData,
    })

    await page.goto("/login")
    await page.waitForLoadState("networkidle")

    await page.getByLabel("Email").fill(userData.email)
    await page.getByLabel("Password").fill("wrong-password")
    await page.getByRole("button", { name: "Login" }).click()

    await expect(page.getByText(/failed|invalid|incorrect/i)).toBeVisible()
  })

  test("shows error for non-existent email", async ({ page }) => {
    await page.goto("/login")
    await page.waitForLoadState("networkidle")

    await page.getByLabel("Email").fill("nobody@example.com")
    await page.getByLabel("Password").fill("password123456")
    await page.getByRole("button", { name: "Login" }).click()

    await expect(page.getByText(/failed|invalid|incorrect/i)).toBeVisible()
  })

  test("shows validation for empty required fields", async ({ page }) => {
    await page.goto("/login")
    await page.waitForLoadState("networkidle")

    await page.getByRole("button", { name: "Login" }).click()

    const emailInput = page.getByLabel("Email")
    const isInvalid = await emailInput.evaluate(
      (el: HTMLInputElement) => !el.validity.valid
    )
    expect(isInvalid).toBe(true)
  })

  test("offers Google sign-in with the terms notice", async ({ page }) => {
    await page.goto("/login")
    await expect(
      page.getByRole("button", { name: "Continue with Google" })
    ).toBeVisible()
    await expect(page.getByText(/agree to our/i)).toBeVisible()
  })
})
