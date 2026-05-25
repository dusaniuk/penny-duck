import { faker } from "@faker-js/faker"
import { type APIRequestContext, type Page, expect } from "@playwright/test"

export function createUserData() {
  return {
    name: faker.person.fullName(),
    email: faker.internet.email(),
    password: faker.internet.password({ length: 12 }),
  }
}

export async function signupAndLogin(request: APIRequestContext) {
  const user = createUserData()
  await request.post("/auth/signup", { data: user })
  await request.post("/auth/login", {
    data: { email: user.email, password: user.password },
  })
  return user
}

export async function signupAndLoginViaPage(page: Page) {
  const user = createUserData()

  await page.goto("/signup")
  await page.waitForLoadState("networkidle")
  await page.getByLabel("Name").fill(user.name)
  await page.getByLabel("Email").fill(user.email)
  await page.getByLabel("Password").fill(user.password)
  await page.getByRole("button", { name: "Sign up" }).click()

  // Signup shows success page with link to login
  await page.getByRole("link", { name: "login" }).click()
  await expect(page).toHaveURL(/\/login/)

  await page.getByLabel("Email").fill(user.email)
  await page.getByLabel("Password").fill(user.password)
  await page.getByRole("button", { name: "Login" }).click()

  await expect(page).toHaveURL(/\/dashboard/)
  return user
}

export async function generateInviteLink(request: APIRequestContext) {
  const res = await request.post("/auth/invite-code")
  expect(res.status()).toBe(200)
  const body = await res.json()
  return body as { inviteCode: string; inviteUrl: string }
}

export function createTransactionData(
  overrides: Partial<{
    accountId: string
    type: string
    amount: number
    categoryId: string
    date: string
    note: string
    originalAmount: number
    originalCurrency: string
    exchangeRate: number
  }> = {},
) {
  return {
    accountId: overrides.accountId ?? faker.string.uuid(),
    type: overrides.type ?? "expense",
    amount: overrides.amount ?? Number(faker.finance.amount({ min: 1, max: 500 })),
    categoryId: overrides.categoryId ?? faker.string.uuid(),
    date: overrides.date ?? new Date().toISOString(),
    ...(overrides.note !== undefined ? { note: overrides.note } : {}),
    ...(overrides.originalAmount !== undefined
      ? {
          originalAmount: overrides.originalAmount,
          originalCurrency: overrides.originalCurrency,
          exchangeRate: overrides.exchangeRate,
        }
      : {}),
  }
}

export function createAccountData(
  overrides: Partial<{
    name: string
    type: string
    currency: string
    balance: number
  }> = {},
) {
  return {
    name: overrides.name ?? `${faker.finance.accountName()} ${faker.string.alphanumeric(4)}`,
    type: overrides.type ?? faker.helpers.arrayElement(["bank", "brokerage"]),
    currency: overrides.currency ?? faker.helpers.arrayElement(["UAH", "PLN", "USD", "EUR"]),
    ...("balance" in overrides ? { balance: overrides.balance } : {}),
  }
}
