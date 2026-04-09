import { faker } from "@faker-js/faker"
import { EventBus } from "@nestjs/cqrs"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { User } from "../../domain/entities/user.entity"
import { EmailAlreadyExistsError } from "../../domain/errors/auth.errors"
import { UserRegisteredEvent } from "../../domain/events/user-registered.event"
import { RefreshTokenRepository } from "../../infrastructure/repositories/refresh-token.repository"
import { UserRepository } from "../../infrastructure/repositories/user.repository"
import { SignupCommand, SignupHandler } from "./signup.command"

describe("SignupHandler", () => {
  let handler: SignupHandler
  let userRepo: UserRepository
  let tokenRepo: RefreshTokenRepository
  let eventBus: EventBus

  beforeEach(() => {
    userRepo = {
      findByEmail: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockImplementation(async (user: User) => user),
    } as unknown as UserRepository

    tokenRepo = {
      save: vi.fn().mockImplementation(async (token) => token),
      findNonExpiredByFamilyId: vi.fn(),
      revokeAllByFamilyId: vi.fn(),
      findAllNonExpired: vi.fn(),
    } as unknown as RefreshTokenRepository

    eventBus = { publish: vi.fn() } as unknown as EventBus

    handler = new SignupHandler(userRepo, tokenRepo, eventBus)
  })

  it("creates a user and returns tokens", async () => {
    const command = new SignupCommand(
      faker.person.fullName(),
      faker.internet.email(),
      faker.internet.password({ length: 16 })
    )
    const result = await handler.execute(command)
    expect(result.accessToken).toBeDefined()
    expect(result.refreshToken).toBeDefined()
    expect(result.user).toBeDefined()
    expect(userRepo.save).toHaveBeenCalled()
    expect(tokenRepo.save).toHaveBeenCalled()
  })

  it("publishes UserRegisteredEvent", async () => {
    const command = new SignupCommand(
      faker.person.fullName(),
      faker.internet.email(),
      faker.internet.password({ length: 16 })
    )
    await handler.execute(command)
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.any(UserRegisteredEvent)
    )
  })

  it("throws EmailAlreadyExistsError if email is taken", async () => {
    const existingUser = await User.register(
      faker.person.fullName(),
      faker.internet.email(),
      faker.internet.password({ length: 16 })
    )
    vi.mocked(userRepo.findByEmail).mockResolvedValue(existingUser)
    const command = new SignupCommand(
      faker.person.fullName(),
      existingUser.email,
      faker.internet.password({ length: 16 })
    )
    await expect(handler.execute(command)).rejects.toThrow(
      EmailAlreadyExistsError
    )
  })
})
