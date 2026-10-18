import { describe, expect, it } from "vitest"
import { MINUS, formatBalance, formatSigned, toTypographicMinus } from "./money"

describe("formatSigned", () => {
  it("prefixes positives with +", () => {
    expect(formatSigned(12.5)).toBe("+12.50")
  })

  it("prefixes negatives with a true minus sign", () => {
    expect(formatSigned(-42.5)).toBe(`${MINUS}42.50`)
  })

  it("leaves zero unsigned", () => {
    expect(formatSigned(0)).toBe("0.00")
  })
})

describe("toTypographicMinus", () => {
  it("swaps the hyphen-minus that Intl emits", () => {
    const formatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(-5)
    expect(toTypographicMinus(formatted)).toBe(`${MINUS}$5.00`)
  })
})

describe("formatBalance", () => {
  it("formats to two decimals with a true minus sign", () => {
    expect(formatBalance(-223000, "en-US")).toBe(`${MINUS}223,000.00`)
  })

  it("leaves positives unsigned", () => {
    expect(formatBalance(1234.5, "en-US")).toBe("1,234.50")
  })
})
