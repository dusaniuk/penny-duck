import { faker } from "@faker-js/faker"
import { EventBus } from "@nestjs/cqrs"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { User } from "../../domain/entities/user.entity"
import { InvalidCredentialsError } from "../../domain/errors/auth.errors"
import { UserLoggedInEvent } from "../../domain/events/user-logged-in.event"
import { RefreshTokenRepository } from "../../domain/repositories/refresh-token.repository"
import { UserRepository } from "../../domain/repositories/user.repository"
import { LoginCommand, LoginHandler } from "./login.command"

describe("LoginHandler", () => {
  let handler: LoginHandler
  let userRepo: UserRepository
  let tokenRepo: RefreshTokenRepository
  let eventBus: EventBus
  const password = "valid-password-123"

  beforeEach(() => {
    userRepo = {
      findByEmail: vi.fn().mockResolvedValue(null),
      save: vi.fn(),
    } as unknown as UserRepository

    tokenRepo = {
      save: vi.fn().mockImplementation(async (token) => token),
      findNonExpiredByFamilyId: vi.fn(),
      revokeAllByFamilyId: vi.fn(),
      findAllNonExpired: vi.fn(),
    } as unknown as RefreshTokenRepository

    eventBus = { publish: vi.fn() } as unknown as EventBus

    handler = new LoginHandler(userRepo, tokenRepo, eventBus)
  })

  it("returns tokens for valid credentials", async () => {
    const user = await User.register(
      faker.person.fullName(),
      faker.internet.email(),
      password
    )
    vi.mocked(userRepo.findByEmail).mockResolvedValue(user)
    const command = new LoginCommand(user.email, password)
    const result = await handler.execute(command)
    expect(result.accessToken).toBeDefined()
    expect(result.refreshToken).toBeDefined()
    expect(result.user).toBeDefined()
    expect(tokenRepo.save).toHaveBeenCalled()
  })

  it("publishes UserLoggedInEvent", async () => {
    const user = await User.register(
      faker.person.fullName(),
      faker.internet.email(),
      password
    )
    vi.mocked(userRepo.findByEmail).mockResolvedValue(user)
    const command = new LoginCommand(user.email, password)
    await handler.execute(command)
    expect(eventBus.publish).toHaveBeenCalledWith(expect.any(UserLoggedInEvent))
  })

  it("throws InvalidCredentialsError for unknown email", async () => {
    const command = new LoginCommand(faker.internet.email(), password)
    await expect(handler.execute(command)).rejects.toThrow(
      InvalidCredentialsError
    )
  })

  it("throws InvalidCredentialsError for wrong password", async () => {
    const user = await User.register(
      faker.person.fullName(),
      faker.internet.email(),
      password
    )
    vi.mocked(userRepo.findByEmail).mockResolvedValue(user)
    const command = new LoginCommand(user.email, "wrong-password!")
    await expect(handler.execute(command)).rejects.toThrow(
      InvalidCredentialsError
    )
  })
})
