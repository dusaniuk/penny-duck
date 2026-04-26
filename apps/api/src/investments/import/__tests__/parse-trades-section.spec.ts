import { readFileSync } from "node:fs"
import { join } from "node:path"

import { describe, it, expect } from "vitest"

import { parseTradesSection } from "../parse-trades-section"
import { splitSections } from "../split-sections"

const FIXTURES = join(__dirname, "..", "fixtures")

describe("parseTradesSection", () => {
  it("parses a single BUY row into one ParsedEvent", () => {
    const csv = readFileSync(join(FIXTURES, "trades-only.csv"), "utf8")
    const [section] = splitSections(csv)
    const { events, errors } = parseTradesSection(section)
    expect(errors).toHaveLength(0)
    expect(events).toHaveLength(1)
    const ev = events[0]
    expect(ev.kind).toBe("buy")
    if (ev.kind !== "buy" && ev.kind !== "sell") throw new Error("expected trade event")
    expect(ev.symbol).toBe("VOO")
    expect(ev.quantity).toBe(8)
    expect(ev.price).toBe(418.98)
    expect(ev.fees).toBe(1)
    expect(ev.currency).toBe("USD")
    expect(ev.externalId).toBe("1000001876")
    expect(ev.externalSource).toBe("ibkr_flex_query")
    expect(ev.externalMetadata.section).toBe("trades")
    expect(ev.externalMetadata.execId).toBe("exec-1")
    expect(ev.externalMetadata.notes).toEqual(["P"])
    expect(ev.date.toISOString()).toBe("2022-02-02T09:30:00.000Z")
  })

  it("parses the full trades section from trades-and-dividends fixture", () => {
    const csv = readFileSync(join(FIXTURES, "trades-and-dividends.csv"), "utf8")
    const [section] = splitSections(csv)
    const { events, errors } = parseTradesSection(section)
    expect(errors).toHaveLength(0)
    expect(events).toHaveLength(33)
    expect(events.every((e) => e.kind === "buy")).toBe(true)
    expect(events.every((e) => e.externalId !== "")).toBe(true)
    const qtyBySymbol = events.reduce<Record<string, number>>((acc, e) => {
      if (e.kind !== "buy" && e.kind !== "sell") return acc
      acc[e.symbol] = (acc[e.symbol] ?? 0) + e.quantity
      return acc
    }, {})
    expect(qtyBySymbol.BND).toBeCloseTo(4.8504, 4)
  })

  it("emits a row error for unsupported TransactionType", () => {
    const header = [
      "ClientAccountID",
      "AccountAlias",
      "Model",
      "CurrencyPrimary",
      "FXRateToBase",
      "AssetClass",
      "SubCategory",
      "Symbol",
      "TradeID",
      "Multiplier",
      "DateTime",
      "TradeDate",
      "TransactionType",
      "Quantity",
      "TradePrice",
      "IBCommission",
      "Open/CloseIndicator",
      "Notes/Codes",
      "Buy/Sell",
      "IBExecID",
    ]
    const row: Record<string, string> = {
      ClientAccountID: "U1",
      AccountAlias: "",
      Model: "",
      CurrencyPrimary: "USD",
      FXRateToBase: "1",
      AssetClass: "STK",
      SubCategory: "ETF",
      Symbol: "VOO",
      TradeID: "1",
      Multiplier: "1",
      DateTime: "20240101;100000",
      TradeDate: "20240101",
      TransactionType: "CorporateAction",
      Quantity: "1",
      TradePrice: "100",
      IBCommission: "0",
      "Open/CloseIndicator": "O",
      "Notes/Codes": "",
      "Buy/Sell": "BUY",
      IBExecID: "e1",
    }
    const section = { header, rows: [row], headerLine: 1, rowLines: [2] }
    const { events, errors } = parseTradesSection(section)
    expect(events).toHaveLength(0)
    expect(errors).toHaveLength(1)
    expect(errors[0].reason).toMatch(/TransactionType/)
  })
})
