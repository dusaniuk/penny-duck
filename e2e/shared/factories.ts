import { faker } from "@faker-js/faker"

export function createUserData() {
  return {
    name: faker.person.fullName(),
    email: faker.internet.email(),
    password: faker.internet.password({ length: 12 }),
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
