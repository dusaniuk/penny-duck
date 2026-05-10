import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, it, expect } from "vitest"

import { groupDividends } from "../group-dividends"
import { parseCashTxnsSection } from "../parse-cash-txns-section"
import { splitSections } from "../split-sections"

const FIXTURES = join(__dirname, "..", "fixtures")

describe("groupDividends", () => {
  it("simple 1-div + 1-tax → one event with both", () => {
    const csv = readFileSync(join(FIXTURES, "dividends-only.csv"), "utf8")
    const [section] = splitSections(csv)
    const cash = parseCashTxnsSection(section)
    const { events, errors } = groupDividends(cash.dividends, cash.taxes)
    expect(errors).toHaveLength(0)
    expect(events).toHaveLength(1)
    const ev = events[0]
    expect(ev.kind).toBe("dividend")
    expect(ev.symbol).toBe("VOO")
    if (ev.kind !== "dividend") throw new Error("expected dividend event")
    expect(ev.amount).toBeCloseTo(23.76, 2)
    expect(ev.withheldTax).toBeCloseTo(-3.56, 2)
    expect(ev.externalMetadata.withholdingRows).toBe(1)
    expect(ev.externalMetadata.dividendType).toBe("Ordinary Dividend")
    expect(ev.externalId).toBe("10000000049")
  })

  it("BND-style 1-div + 3-tax rows → one event, withheldTax = sum of all tax", () => {
    const csv = readFileSync(join(FIXTURES, "bnd-complex-withholding.csv"), "utf8")
    const [section] = splitSections(csv)
    const cash = parseCashTxnsSection(section)
    const { events, errors } = groupDividends(cash.dividends, cash.taxes)
    expect(errors).toHaveLength(0)
    expect(events).toHaveLength(1)
    const ev = events[0]
    expect(ev.kind).toBe("dividend")
    expect(ev.symbol).toBe("BND")
    if (ev.kind !== "dividend") throw new Error("expected dividend event")
    expect(ev.amount).toBeCloseTo(0.77, 2)
    expect(ev.withheldTax).toBeCloseTo(-0.02, 2)
    expect(ev.externalMetadata.withholdingRows).toBe(3)
  })

  it("orphan tax with no matching dividend → error", () => {
    const { events, errors } = groupDividends(
      [],
      [{ Symbol: "XYZ", "Date/Time": "20250101", Amount: "-1.00", TransactionID: "t1", line: 2 }]
    )
    expect(events).toHaveLength(0)
    expect(errors).toHaveLength(1)
    expect(errors[0].reason).toMatch(/orphan|no matching/i)
  })

  it("dividend without tax → event with withheldTax=0", () => {
    const { events, errors } = groupDividends(
      [
        {
          Symbol: "ABC",
          "Date/Time": "20250101;202000",
          Amount: "5.00",
          TransactionID: "tx1",
          ExDate: "20241230",
          SettleDate: "20250101",
          DividendType: "Ordinary Dividend",
          Description: "ABC div",
          ClientAccountID: "U1",
          ActionID: "a1",
          line: 2,
        },
      ],
      []
    )
    expect(errors).toHaveLength(0)
    expect(events).toHaveLength(1)
    const ev = events[0]
    expect(ev.kind).toBe("dividend")
    if (ev.kind !== "dividend") throw new Error("expected dividend event")
    expect(ev.amount).toBeCloseTo(5.0, 2)
    expect(ev.withheldTax).toBe(0)
    expect(ev.externalMetadata.withholdingRows).toBe(0)
  })
})
