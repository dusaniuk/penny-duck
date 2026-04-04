import { faker } from "@faker-js/faker"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { RefreshToken } from "../../domain/entities/refresh-token.entity"
import { InvalidTokenError } from "../../domain/errors/auth.errors"
import { RefreshTokenRepository } from "../../domain/repositories/refresh-token.repository"
import { TokenFamily } from "../../domain/value-objects/token-family.vo"
import { LogoutCommand, LogoutHandler } from "./logout.command"

describe("LogoutHandler", () => {
  let handler: LogoutHandler
  let tokenRepo: RefreshTokenRepository

  beforeEach(() => {
    tokenRepo = {
      save: vi.fn(),
      findNonExpiredByFamilyId: vi.fn().mockResolvedValue([]),
      revokeAllByFamilyId: vi.fn(),
      findAllNonExpired: vi.fn().mockResolvedValue([]),
    } as unknown as RefreshTokenRepository

    handler = new LogoutHandler(tokenRepo)
  })

  it("revokes the token family on valid token", async () => {
    const family = TokenFamily.create()
    const { token, rawValue } = await RefreshToken.issue(
      faker.string.uuid(),
      family,
      7
    )
    vi.mocked(tokenRepo.findAllNonExpired).mockResolvedValue([token])

    const command = new LogoutCommand(rawValue)
    await handler.execute(command)

    expect(tokenRepo.revokeAllByFamilyId).toHaveBeenCalledWith(family.value)
  })

  it("throws InvalidTokenError when no token matches", async () => {
    vi.mocked(tokenRepo.findAllNonExpired).mockResolvedValue([])
    const command = new LogoutCommand("nonexistent-token")
    await expect(handler.execute(command)).rejects.toThrow(InvalidTokenError)
  })
})
