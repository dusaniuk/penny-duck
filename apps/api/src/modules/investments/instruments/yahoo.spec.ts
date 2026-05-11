import { describe, it, expect, beforeEach } from "bun:test"
import { quoteMock, searchMock } from "@/test/yahoo-mock"
import { fetchQuotes, searchYahoo, RateLimitedError } from "./yahoo"

beforeEach(() => {
  quoteMock.mockReset()
  searchMock.mockReset()
})

describe("fetchQuotes", () => {
  it("maps quote responses to normalized shape", async () => {
    quoteMock.mockResolvedValue([
      {
        symbol: "AAPL",
        longName: "Apple Inc.",
        fullExchangeName: "NasdaqGS",
        currency: "USD",
        regularMarketPrice: 192.34,
      },
    ])
    const result = await fetchQuotes(["AAPL"])
    expect(result).toEqual([
      {
        symbol: "AAPL",
        name: "Apple Inc.",
        exchange: "NasdaqGS",
        currency: "USD",
        price: 192.34,
      },
    ])
  })

  it("omits symbols with no price", async () => {
    quoteMock.mockResolvedValue([
      {
        symbol: "AAPL",
        regularMarketPrice: undefined,
        currency: "USD",
        longName: "Apple",
      },
    ])
    const result = await fetchQuotes(["AAPL"])
    expect(result).toEqual([])
  })

  it("translates 429 into RateLimitedError", async () => {
    quoteMock.mockRejectedValue(
      Object.assign(new Error("Too many"), {
        name: "HTTPError",
        response: { status: 429 },
      })
    )
    await expect(fetchQuotes(["AAPL"])).rejects.toBeInstanceOf(RateLimitedError)
  })

  it("rethrows other errors", async () => {
    quoteMock.mockRejectedValue(new Error("network"))
    await expect(fetchQuotes(["AAPL"])).rejects.toThrow("network")
  })

  it("returns empty array when called with no symbols", async () => {
    const result = await fetchQuotes([])
    expect(result).toEqual([])
    expect(quoteMock).not.toHaveBeenCalled()
  })
})

describe("searchYahoo", () => {
  it("maps search quote entries and filters to equity/etf", async () => {
    searchMock.mockResolvedValue({
      quotes: [
        { symbol: "AAPL", shortname: "Apple Inc.", exchange: "NAS", quoteType: "EQUITY" },
        { symbol: "MSFT", shortname: "Microsoft", exchange: "NAS", quoteType: "EQUITY" },
        { symbol: "SOMETHING", quoteType: "NEWS" },
      ],
    })
    const result = await searchYahoo("apple")
    expect(result).toEqual([
      { symbol: "AAPL", name: "Apple Inc.", exchange: "NAS" },
      { symbol: "MSFT", name: "Microsoft", exchange: "NAS" },
    ])
  })

  it("returns empty list when yahoo returns no quotes field", async () => {
    searchMock.mockResolvedValue({})
    const result = await searchYahoo("xyz")
    expect(result).toEqual([])
  })

  it("translates 429 on search into RateLimitedError", async () => {
    searchMock.mockRejectedValue(
      Object.assign(new Error("Too many"), { response: { status: 429 } })
    )
    await expect(searchYahoo("xyz")).rejects.toBeInstanceOf(RateLimitedError)
  })
})
