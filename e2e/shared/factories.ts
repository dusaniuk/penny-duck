import { faker } from "@faker-js/faker"

export function createUserData() {
  return {
    name: faker.person.fullName(),
    email: faker.internet.email(),
    password: faker.internet.password({ length: 12 }),
  }
}

export function createTransactionData(
  overrides: Partial<{
    accountId: string
    type: string
    amount: number
    categoryId: string
    date: string
    note: string
    myShare: number
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
    ...(overrides.myShare !== undefined ? { myShare: overrides.myShare } : {}),
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
    type: overrides.type ?? faker.helpers.arrayElement(["bank", "cash"]),
    currency: overrides.currency ?? faker.helpers.arrayElement(["UAH", "PLN", "USD", "EUR"]),
    ...("balance" in overrides ? { balance: overrides.balance } : {}),
  }
}
