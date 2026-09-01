import type { MiddlewareHandler } from "hono"
import { HTTPException } from "hono/http-exception"

type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()

// Enforce real limits on Railway (the authoritative prod signal, always set by
// the platform). Read live rather than via a cached const so it stays correct
// regardless of import order and remains togglable in tests. NODE_ENV is
// deliberately NOT used: nothing sets it to "production" on the Bun runtime,
// which previously left brute-force protection silently disabled in prod.
function limitsEnforced(): boolean {
  return process.env.RAILWAY_ENVIRONMENT_NAME === "production"
}

export interface RateLimitOptions {
  limit: number
  ttl: number
}

// Derive the client IP from the trusted proxy hop, not from client-controlled
// headers. Railway appends the real peer IP to the END of X-Forwarded-For, so
// the last entry is authoritative; the leftmost entries can be forged by the
// client to mint a fresh bucket per request and defeat the limit entirely.
function clientIp(c: Parameters<MiddlewareHandler>[0]): string {
  const forwarded = c.req.header("x-forwarded-for")
  if (forwarded) {
    const hops = forwarded.split(",")
    const last = hops[hops.length - 1]?.trim()
    if (last) return last
  }
  return c.req.header("x-real-ip") ?? "unknown"
}

// Drop expired buckets so the Map can't grow without bound.
function pruneExpired(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(key)
  }
}

export function rateLimit({ limit, ttl }: RateLimitOptions): MiddlewareHandler {
  return async (c, next) => {
    const effectiveLimit = limitsEnforced() ? limit : 10_000
    const key = `${c.req.routePath}:${clientIp(c)}`
    const now = Date.now()
    const bucket = buckets.get(key)
    if (!bucket || bucket.resetAt < now) {
      if (buckets.size > 10_000) pruneExpired(now)
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
