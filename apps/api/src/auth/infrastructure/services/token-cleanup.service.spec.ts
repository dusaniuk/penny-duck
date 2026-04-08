import { beforeEach, describe, expect, it, vi } from "vitest"
import { RefreshTokenRepository } from "../../domain/repositories/refresh-token.repository"
import { TokenCleanupService } from "./token-cleanup.service"

describe("TokenCleanupService", () => {
  let service: TokenCleanupService
  let tokenRepo: RefreshTokenRepository

  beforeEach(() => {
    tokenRepo = {
      save: vi.fn(),
      findNonExpiredByFamilyId: vi.fn(),
      revokeAllByFamilyId: vi.fn(),
      findAllNonExpired: vi.fn(),
      deleteExpired: vi.fn().mockResolvedValue(5),
    } as unknown as RefreshTokenRepository

    service = new TokenCleanupService(tokenRepo)
  })

  it("deletes expired tokens and logs the count", async () => {
    await service.handleCleanup()

    expect(tokenRepo.deleteExpired).toHaveBeenCalledOnce()
  })

  it("handles zero expired tokens", async () => {
    vi.mocked(tokenRepo.deleteExpired).mockResolvedValue(0)

    await service.handleCleanup()

    expect(tokenRepo.deleteExpired).toHaveBeenCalledOnce()
  })
})
