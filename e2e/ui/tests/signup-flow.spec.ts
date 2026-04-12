import { test, expect } from "@playwright/test"
import { createUserData } from "../../shared/factories"

test.describe("Signup flow", () => {
  test("signs up and shows success with login link", async ({ page }) => {
    const user = createUserData()

    await page.goto("/signup")
    await page.waitForLoadState("networkidle")

    await page.getByLabel("Name").fill(user.name)
    await page.getByLabel("Email").fill(user.email)
    await page.getByLabel("Password").fill(user.password)
    await page.getByRole("button", { name: "Sign up" }).click()

    await expect(page.getByText("Account created!")).toBeVisible()
    await expect(page.getByRole("link", { name: "login" })).toBeVisible()
  })

  test("can login after signup", async ({ page }) => {
    const user = createUserData()

    await page.goto("/signup")
    await page.waitForLoadState("networkidle")

    await page.getByLabel("Name").fill(user.name)
    await page.getByLabel("Email").fill(user.email)
    await page.getByLabel("Password").fill(user.password)
    await page.getByRole("button", { name: "Sign up" }).click()

    await page.getByRole("link", { name: "login" }).click()
    await expect(page).toHaveURL(/\/login/)

    await page.getByLabel("Email").fill(user.email)
    await page.getByLabel("Password").fill(user.password)
    await page.getByRole("button", { name: "Login" }).click()

    await expect(page).toHaveURL(/\/dashboard/)
  })

  test("shows success for duplicate email (no error exposure)", async ({
    page,
  }) => {
    const user = createUserData()

    // Signup once
    await page.goto("/signup")
    await page.waitForLoadState("networkidle")
    await page.getByLabel("Name").fill(user.name)
    await page.getByLabel("Email").fill(user.email)
    await page.getByLabel("Password").fill(user.password)
    await page.getByRole("button", { name: "Sign up" }).click()
    await expect(page.getByText("Account created!")).toBeVisible()

    // Signup again with same email — should still show success (no email enumeration)
    await page.goto("/signup")
    await page.waitForLoadState("networkidle")
    await page.getByLabel("Name").fill("Different Name")
    await page.getByLabel("Email").fill(user.email)
    await page.getByLabel("Password").fill(user.password)
    await page.getByRole("button", { name: "Sign up" }).click()
    await expect(page.getByText("Account created!")).toBeVisible()
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
