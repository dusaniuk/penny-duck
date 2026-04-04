import { faker } from "@faker-js/faker"
import { EventBus } from "@nestjs/cqrs"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { RefreshToken } from "../../domain/entities/refresh-token.entity"
import {
  InvalidTokenError,
  TokenReuseDetectedError,
} from "../../domain/errors/auth.errors"
import { RefreshTokenRepository } from "../../domain/repositories/refresh-token.repository"
import { TokenFamily } from "../../domain/value-objects/token-family.vo"
import {
  RefreshTokensCommand,
  RefreshTokensHandler,
} from "./refresh-tokens.command"

describe("RefreshTokensHandler", () => {
  let handler: RefreshTokensHandler
  let tokenRepo: RefreshTokenRepository
  let eventBus: EventBus

  beforeEach(() => {
    tokenRepo = {
      save: vi.fn().mockImplementation(async (token) => token),
      findNonExpiredByFamilyId: vi.fn().mockResolvedValue([]),
      revokeAllByFamilyId: vi.fn(),
      findAllNonExpired: vi.fn().mockResolvedValue([]),
    } as unknown as RefreshTokenRepository

    eventBus = { publish: vi.fn() } as unknown as EventBus

    handler = new RefreshTokensHandler(tokenRepo, eventBus)
  })

  it("rotates a valid refresh token", async () => {
    const family = TokenFamily.create()
    const { token, rawValue } = await RefreshToken.issue(
      faker.string.uuid(),
      family,
      7
    )
    vi.mocked(tokenRepo.findAllNonExpired).mockResolvedValue([token])

    const command = new RefreshTokensCommand(rawValue)
    const result = await handler.execute(command)

    expect(result.accessToken).toBeDefined()
    expect(result.refreshToken).toBeDefined()
    expect(token.revoked).toBe(true)
    expect(tokenRepo.save).toHaveBeenCalled()
  })

  it("throws InvalidTokenError when no token matches", async () => {
    vi.mocked(tokenRepo.findAllNonExpired).mockResolvedValue([])
    const command = new RefreshTokensCommand("nonexistent-token")
    await expect(handler.execute(command)).rejects.toThrow(InvalidTokenError)
  })

  it("throws TokenReuseDetectedError when revoked token is used", async () => {
    const family = TokenFamily.create()
    const { token, rawValue } = await RefreshToken.issue(
      faker.string.uuid(),
      family,
      7
    )
    token.revoke()
    vi.mocked(tokenRepo.findAllNonExpired).mockResolvedValue([token])

    const command = new RefreshTokensCommand(rawValue)
    await expect(handler.execute(command)).rejects.toThrow(
      TokenReuseDetectedError
    )
    expect(tokenRepo.revokeAllByFamilyId).toHaveBeenCalledWith(family.value)
  })
})
