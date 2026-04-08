import { Injectable, Logger } from "@nestjs/common"
import { Cron, CronExpression } from "@nestjs/schedule"
import { RefreshTokenRepository } from "../../domain/repositories/refresh-token.repository"

@Injectable()
export class TokenCleanupService {
  private readonly logger = new Logger(TokenCleanupService.name)

  constructor(private readonly tokenRepo: RefreshTokenRepository) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleCleanup() {
    const deleted = await this.tokenRepo.deleteExpired()
    this.logger.log(`Cleaned up ${deleted} expired refresh tokens`)
  }
}
