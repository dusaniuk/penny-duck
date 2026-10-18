import { describe, expect, it } from "vitest"
import { MINUS, formatMoney, moneyParts } from "./money"

describe("moneyParts", () => {
  it("splits a grouped figure into whole and two-digit fraction", () => {
    expect(moneyParts(48210.5, { locale: "en-US" })).toEqual({
      sign: "",
      whole: "48,210",
      decimal: ".",
      fraction: "50",
    })
  })

  it("uses a true minus sign for negatives", () => {
    expect(moneyParts(-223000, { locale: "en-US" }).sign).toBe(MINUS)
  })

  it("adds + to positives only when signed", () => {
    expect(moneyParts(12.5, { locale: "en-US" }).sign).toBe("")
    expect(moneyParts(12.5, { locale: "en-US", signed: true }).sign).toBe("+")
  })

  it("leaves zero unsigned, including values that round to zero", () => {
    expect(moneyParts(0, { signed: true }).sign).toBe("")
    expect(moneyParts(-0.004, { signed: true }).sign).toBe("")
  })

  it("follows the locale's grouping and decimal separators", () => {
    expect(moneyParts(1234.5, { locale: "de-DE" })).toEqual({
      sign: "",
      whole: "1.234",
      decimal: ",",
      fraction: "50",
    })
  })
})

describe("formatMoney", () => {
  it("puts the ISO code after the figure", () => {
    expect(formatMoney(-1234.5, { locale: "en-US", currency: "EUR" })).toBe(
      `${MINUS}1,234.50 EUR`
    )
  })

  it("omits the code when no currency is given", () => {
    expect(formatMoney(3, { locale: "en-US", signed: true })).toBe("+3.00")
  })
})
