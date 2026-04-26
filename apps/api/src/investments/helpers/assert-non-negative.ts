import { ConflictException } from "@nestjs/common"
import type { ReplayTrade } from "./replay-position"

/**
 * Throws ConflictException if replaying the trades would ever drive the
 * running quantity below zero. Uses the same date+createdAt ordering as
 * `replayPosition` so the two stay consistent.
 */
export function assertNonNegative(trades: ReplayTrade[]): void {
  const sorted = [...trades].sort((a, b) => {
    const d = a.date.getTime() - b.date.getTime()
    if (d !== 0) return d
    return a.createdAt.getTime() - b.createdAt.getTime()
  })

  let qty = 0
  for (const t of sorted) {
    if (t.type === "buy" && t.quantity != null) qty += t.quantity
    else if (t.type === "sell" && t.quantity != null) qty -= t.quantity
    if (qty < 0) {
      throw new ConflictException(
        "Operation would leave a negative position quantity"
      )
    }
  }
}
