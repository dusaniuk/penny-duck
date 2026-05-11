import type { MiddlewareHandler } from "hono"
import { HTTPException } from "hono/http-exception"

type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

export interface RateLimitOptions {
  limit: number
  ttl: number
}

export function rateLimit({
  limit,
  ttl,
}: RateLimitOptions): MiddlewareHandler {
  return async (c, next) => {
    const effectiveLimit =
      process.env.NODE_ENV === "production" ? limit : 10_000
    const ip =
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("x-real-ip") ??
      "unknown"
    const key = `${c.req.routePath}:${ip}`
    const now = Date.now()
    const bucket = buckets.get(key)
    if (!bucket || bucket.resetAt < now) {
      buckets.set(key, { count: 1, resetAt: now + ttl })
    } else if (bucket.count >= effectiveLimit) {
      throw new HTTPException(429, { message: "Too many requests" })
    } else {
      bucket.count++
    }
    await next()
  }
}

// Test-only: lets specs reset bucket state between cases.
export function __resetRateLimitBuckets(): void {
  buckets.clear()
}
