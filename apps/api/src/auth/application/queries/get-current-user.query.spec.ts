import { faker } from "@faker-js/faker"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { User } from "../../domain/entities/user.entity"
import { InvalidTokenError } from "../../domain/errors/auth.errors"
import { UserRepository } from "../../domain/repositories/user.repository"
import {
  GetCurrentUserHandler,
  GetCurrentUserQuery,
} from "./get-current-user.query"

describe("GetCurrentUserHandler", () => {
  let handler: GetCurrentUserHandler
  let userRepo: UserRepository

  beforeEach(() => {
    userRepo = {
      findByEmail: vi.fn().mockResolvedValue(null),
      save: vi.fn(),
    } as unknown as UserRepository

    handler = new GetCurrentUserHandler(userRepo)
  })

  it("returns user data for a valid email", async () => {
    const email = faker.internet.email().toLowerCase()
    const name = faker.person.fullName()
    const user = User.fromPersistence({
      id: faker.string.uuid(),
      email,
      name,
      passwordHash: "$2b$12$fakehash",
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    vi.mocked(userRepo.findByEmail).mockResolvedValue(user)

    const query = new GetCurrentUserQuery(faker.string.uuid(), email)
    const result = await handler.execute(query)

    expect(result.id).toBe(user.id)
    expect(result.email).toBe(email)
    expect(result.name).toBe(name)
  })

  it("throws InvalidTokenError when user not found", async () => {
    const query = new GetCurrentUserQuery(
      faker.string.uuid(),
      faker.internet.email()
    )
    await expect(handler.execute(query)).rejects.toThrow(InvalidTokenError)
  })
})
