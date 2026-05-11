import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, it, expect } from "bun:test"

import { parseIbkrCsv } from "../ibkr-csv-parser"

const FIXTURES = join(__dirname, "..", "fixtures")

describe("parseIbkrCsv", () => {
  it("full fixture: 33 buys + 13+ dividends + 5 deposits + 0 errors", () => {
    const csv = readFileSync(join(FIXTURES, "trades-and-dividends.csv"), "utf8")
    const result = parseIbkrCsv(csv)
    expect(result.errors).toHaveLength(0)
    expect(result.clientAccountId).toBe("U0000000")
    const buys = result.events.filter((e) => e.kind === "buy")
    const sells = result.events.filter((e) => e.kind === "sell")
    const divs = result.events.filter((e) => e.kind === "dividend")
    expect(buys).toHaveLength(33)
    expect(sells).toHaveLength(0)
    expect(divs.length).toBeGreaterThan(10)
    expect(divs.length).toBeLessThan(25)
    expect(result.deposits).toHaveLength(5)
    expect(result.deposits.reduce((s, d) => s + d.amount, 0)).toBe(5000)
    expect(result.skipped).toHaveLength(0)
  })

  it("trades-only fixture: 1 buy, 0 dividends, 0 deposits", () => {
    const csv = readFileSync(join(FIXTURES, "trades-only.csv"), "utf8")
    const result = parseIbkrCsv(csv)
    expect(result.errors).toHaveLength(0)
    expect(result.events).toHaveLength(1)
    expect(result.events[0].kind).toBe("buy")
    expect(result.deposits).toHaveLength(0)
    expect(result.skipped).toHaveLength(0)
  })

  it("empty-sections fixture: 0 events, 0 errors", () => {
    const csv = readFileSync(join(FIXTURES, "empty-sections.csv"), "utf8")
    const result = parseIbkrCsv(csv)
    expect(result.events).toHaveLength(0)
    expect(result.deposits).toHaveLength(0)
    expect(result.skipped).toHaveLength(0)
    expect(result.errors).toHaveLength(0)
    expect(result.clientAccountId).toBe(null)
  })

  it("malformed CSV: throws", () => {
    const csv = readFileSync(join(FIXTURES, "malformed.csv"), "utf8")
    expect(() => parseIbkrCsv(csv)).toThrow()
  })
})
