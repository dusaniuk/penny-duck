import { faker } from "@faker-js/faker"

export function createUserData() {
  return {
    name: faker.person.fullName(),
    email: faker.internet.email(),
    password: faker.internet.password({ length: 12 }),
  }
}
