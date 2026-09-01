import { beforeAll, afterAll, beforeEach, describe, it, expect } from "bun:test"
import { eq } from "drizzle-orm"
import { instrumentPrices } from "@workspace/db"
import { db } from "@/db"
import { chartMock } from "@/test/yahoo-mock"
import { closeTestApp, createTestApp, truncateAll } from "@/test/setup"
import { ensureHistoricalPrices, upsertInstrument } from "./service"

beforeAll(async () => {
  await createTestApp()
})

afterAll(() => closeTestApp())

beforeEach(async () => {
  await truncateAll()
  chartMock.mockReset()
})

async function seedAAPL() {
  return upsertInstrument({
    symbol: "AAPL",
    name: "Apple",
    exchange: "NasdaqGS",
    currency: "USD",
    lastPrice: 100,
    lastPricedAt: new Date(),
  })
}

function chartResult(points: { date: string; close: number }[]) {
  return {
    quotes: points.map((p) => ({
      date: new Date(`${p.date}T20:00:00Z`),
      close: p.close,
    })),
  }
}

describe("ensureHistoricalPrices", () => {
  it("backfills the full window when no rows exist", async () => {
    const inst = await seedAAPL()
    chartMock.mockResolvedValue(
      chartResult([
        { date: "2026-05-19", close: 100 },
        { date: "2026-05-20", close: 101 },
        { date: "2026-05-21", close: 102 },
      ])
    )

    await ensureHistoricalPrices([inst.id], 30)

    const rows = await db
      .select()
      .from(instrumentPrices)
      .where(eq(instrumentPrices.instrumentId, inst.id))
    expect(rows.length).toBe(3)
    expect(chartMock).toHaveBeenCalledTimes(1)
  })

  it("no-ops when the latest stored date is recent enough", async () => {
    const inst = await seedAAPL()
    const today = new Date().toISOString().slice(0, 10)
    await db
      .insert(instrumentPrices)
      .values({ instrumentId: inst.id, date: today, close: 100 })

    await ensureHistoricalPrices([inst.id], 30)

    expect(chartMock).not.toHaveBeenCalled()
  })

  it("fetches only the missing slice when partial history exists", async () => {
    const inst = await seedAAPL()
    // Seed a row 10 days old; expect a fetch covering the gap.
    const tenDaysAgo = new Date()
    tenDaysAgo.setUTCDate(tenDaysAgo.getUTCDate() - 10)
    const tenDaysAgoStr = tenDaysAgo.toISOString().slice(0, 10)
    await db
      .insert(instrumentPrices)
      .values({ instrumentId: inst.id, date: tenDaysAgoStr, close: 95 })

    chartMock.mockResolvedValue(chartResult([]))

    await ensureHistoricalPrices([inst.id], 30)

    expect(chartMock).toHaveBeenCalledTimes(1)
    const callArgs = chartMock.mock.calls[0]
    const [, opts] = callArgs as [string, { period1: Date }]
    // We should have requested data starting strictly after the stored date.
    expect(opts.period1.getTime()).toBeGreaterThan(tenDaysAgo.getTime())
  })

  it("soft-fails on Yahoo errors and leaves existing data", async () => {
    const inst = await seedAAPL()
    chartMock.mockRejectedValue(new Error("boom"))

    await expect(ensureHistoricalPrices([inst.id], 30)).resolves.toBeUndefined()

    const rows = await db
      .select()
      .from(instrumentPrices)
      .where(eq(instrumentPrices.instrumentId, inst.id))
    expect(rows.length).toBe(0)
  })

  it("upserts on conflict, not insert-only", async () => {
    const inst = await seedAAPL()
    chartMock.mockResolvedValueOnce(
      chartResult([{ date: "2026-05-20", close: 100 }])
    )
    await ensureHistoricalPrices([inst.id], 30)

    // Force a re-fetch (clear today's marker — we use latest date check, so
    // a far-old latest date triggers a refetch).
    chartMock.mockResolvedValueOnce(
      chartResult([{ date: "2026-05-20", close: 110 }])
    )
    // Bypass the "recent enough" check by clearing the only row's date to
    // something stale.
    await db
      .update(instrumentPrices)
      .set({ date: "2020-01-01" })
      .where(eq(instrumentPrices.instrumentId, inst.id))

    await ensureHistoricalPrices([inst.id], 30)

    const rows = await db
      .select()
      .from(instrumentPrices)
      .where(eq(instrumentPrices.instrumentId, inst.id))
    expect(rows.find((r) => r.date === "2026-05-20")?.close).toBe(110)
  })

  it("returns immediately on empty input", async () => {
    await ensureHistoricalPrices([], 30)
    expect(chartMock).not.toHaveBeenCalled()
  })
})
