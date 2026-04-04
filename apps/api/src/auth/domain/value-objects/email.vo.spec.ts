import { faker } from "@faker-js/faker"
import { describe, expect, it } from "vitest"
import { Email } from "./email.vo"

describe("Email", () => {
  it("creates a valid email", () => {
    const raw = faker.internet.email()
    const email = Email.create(raw)
    expect(email.value).toBe(raw.toLowerCase().trim())
  })

  it("normalizes email to lowercase and trims whitespace", () => {
    const email = Email.create("  User@Example.COM  ")
    expect(email.value).toBe("user@example.com")
  })

  it("rejects an empty string", () => {
    expect(() => Email.create("")).toThrow("Email cannot be empty")
  })

  it("rejects an invalid email format", () => {
    expect(() => Email.create("not-an-email")).toThrow("Invalid email format")
  })

  it("compares two equal emails", () => {
    const a = Email.create("test@example.com")
    const b = Email.create("TEST@example.com")
    expect(a.equals(b)).toBe(true)
  })

  it("compares two different emails", () => {
    const a = Email.create(faker.internet.email())
    const b = Email.create(faker.internet.email())
    expect(a.equals(b)).toBe(false)
  })
})
