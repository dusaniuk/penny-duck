import { faker } from "@faker-js/faker"
import { describe, expect, it } from "vitest"
import { User } from "./user.entity"

describe("User", () => {
  it("creates a new user with hashed password", async () => {
    const email = faker.internet.email()
    const name = faker.person.fullName()
    const password = faker.internet.password({ length: 16 })

    const user = await User.register(name, email, password)

    expect(user.name).toBe(name)
    expect(user.email).toBe(email.toLowerCase().trim())
    expect(user.passwordHash).toBeDefined()
    expect(user.passwordHash).not.toBe(password)
  })

  it("reconstitutes from stored data", () => {
    const user = User.fromPersistence({
      id: faker.string.uuid(),
      email: faker.internet.email().toLowerCase(),
      name: faker.person.fullName(),
      passwordHash: "$2b$12$fakehashvalue",
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    expect(user.id).toBeDefined()
  })

  it("verifies a correct password", async () => {
    const password = faker.internet.password({ length: 16 })
    const user = await User.register(
      faker.person.fullName(),
      faker.internet.email(),
      password
    )

    const matches = await user.verifyPassword(password)
    expect(matches).toBe(true)
  })

  it("rejects an incorrect password", async () => {
    const user = await User.register(
      faker.person.fullName(),
      faker.internet.email(),
      faker.internet.password({ length: 16 })
    )

    const matches = await user.verifyPassword("wrong-password!")
    expect(matches).toBe(false)
  })

  it("rejects invalid email during registration", async () => {
    await expect(
      User.register(faker.person.fullName(), "not-an-email", "validpassword1")
    ).rejects.toThrow("Invalid email format")
  })

  it("rejects short password during registration", async () => {
    await expect(
      User.register(faker.person.fullName(), faker.internet.email(), "short")
    ).rejects.toThrow("Password must be at least 8 characters")
  })
})
