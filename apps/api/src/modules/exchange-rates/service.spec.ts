import { describe, it, expect, beforeAll, beforeEach, afterAll } from "bun:test"
import { eq, and } from "drizzle-orm"
import { exchangeRates } from "@workspace/db"
import { db } from "@/db"
import { closeTestApp, createTestApp, truncateAll } from "@/test/setup"
import { getLatestRates, getRate } from "./service"

beforeAll(() => createTestApp())
afterAll(() => closeTestApp())
beforeEach(() => truncateAll())

function todayStr() {
  return new Date().toISOString().split("T")[0]
}

async function readCachedRate(
  date: string,
  base: string,
  target: string
): Promise<number | null> {
  const rows = await db
    .select({ rate: exchangeRates.rate })
    .from(exchangeRates)
    .where(
      and(
        eq(exchangeRates.date, date),
        eq(exchangeRates.base, base),
        eq(exchangeRates.target, target)
      )
    )
    .limit(1)
  return rows[0]?.rate ?? null
}

describe("getRate", () => {
  it("returns 1 when base equals target", async () => {
    const rate = await getRate("UAH", "UAH", new Date())
    expect(rate).toBe(1)
  })

  it("fetches and caches a rate", async () => {
    const rate = await getRate("UAH", "PLN", new Date())
    expect(rate).toBeGreaterThan(0)

    const cached = await readCachedRate(todayStr(), "UAH", "PLN")
    expect(cached).toBeCloseTo(rate, 5)
  })

  it("only stores rates for currencies in the used set", async () => {
    await getRate("UAH", "PLN", new Date(), ["UAH", "PLN"])

    const rows = await db
      .select({ target: exchangeRates.target })
      .from(exchangeRates)
      .where(eq(exchangeRates.base, "UAH"))
    expect(rows.map((r) => r.target)).toEqual(["PLN"])
  })

  it("uses the cache on a second call", async () => {
    const first = await getRate("UAH", "PLN", new Date())
    const second = await getRate("UAH", "PLN", new Date())
    // Cache round-trips through the int-scaled `rate` column (6 decimals),
    // so the second call equals the cached value, not the full live rate.
    expect(second).toBeCloseTo(first, 5)
    const cached = await readCachedRate(todayStr(), "UAH", "PLN")
    expect(cached).not.toBeNull()
    expect(second).toBe(cached as number)
  })
})

describe("getLatestRates", () => {
  it("returns cross-pairs and skips self-pairs", async () => {
    const rates = await getLatestRates(["UAH", "PLN", "USD"])

    expect(rates["UAH"]["PLN"]).toBeGreaterThan(0)
    expect(rates["PLN"]["UAH"]).toBeGreaterThan(0)
    expect(rates["USD"]["UAH"]).toBeGreaterThan(0)
    expect(rates["UAH"]["UAH"]).toBeUndefined()
  })
})
