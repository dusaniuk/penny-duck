import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, it, expect } from "vitest"

import { parseCashTxnsSection } from "../parse-cash-txns-section"
import { splitSections } from "../split-sections"

const FIXTURES = join(__dirname, "..", "fixtures")

describe("parseCashTxnsSection", () => {
  it("routes Dividends / Withholding Tax / Deposits to the right buckets", () => {
    const csv = readFileSync(join(FIXTURES, "trades-and-dividends.csv"), "utf8")
    const [, cashSection] = splitSections(csv)
    const result = parseCashTxnsSection(cashSection)
    expect(result.errors).toHaveLength(0)
    expect(result.dividends.length).toBe(21)
    expect(result.taxes.length).toBe(37)
    expect(result.skipped).toHaveLength(0)
    expect(result.deposits.length).toBe(5)
    expect(
      result.deposits.every((d) => d.externalSource === "ibkr_flex_query")
    ).toBe(true)
    const totalDeposits = result.deposits.reduce((sum, d) => sum + d.amount, 0)
    expect(totalDeposits).toBe(5000)
    expect(result.deposits[0].externalId).toBe("10000001841")
    expect(result.deposits[0].currency).toBe("USD")
    expect(result.deposits[0].externalMetadata.type).toBe("Deposits/Withdrawals")
  })

  it("dividends-only fixture → 1 dividend, 1 tax, 0 deposits, 0 errors", () => {
    const csv = readFileSync(join(FIXTURES, "dividends-only.csv"), "utf8")
    const [section] = splitSections(csv)
    const r = parseCashTxnsSection(section)
    expect(r.dividends).toHaveLength(1)
    expect(r.taxes).toHaveLength(1)
    expect(r.deposits).toHaveLength(0)
    expect(r.skipped).toHaveLength(0)
    expect(r.errors).toHaveLength(0)
    expect(r.dividends[0].Amount).toBe("23.76")
    expect(r.taxes[0].Amount).toBe("-3.56")
  })

  it("emits an error for unsupported Type", () => {
    const section = {
      header: ["Symbol", "Type", "Amount", "Date/Time", "TransactionID"],
      rows: [
        {
          Symbol: "VOO",
          Type: "Some New Type",
          Amount: "10",
          "Date/Time": "20250101",
          TransactionID: "42",
        },
      ],
      headerLine: 1,
      rowLines: [2],
    }
    const r = parseCashTxnsSection(section)
    expect(r.errors).toHaveLength(1)
    expect(r.errors[0].reason).toMatch(/Type/)
  })
})
