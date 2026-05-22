import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  it,
  expect,
} from "bun:test"
import {
  closeTestApp,
  createTestApp,
  signupUser,
  truncateAll,
} from "@/test/setup"
import { db } from "@/db"
import { accounts, exchangeRates, instrumentPrices, instruments, trades, transactions } from "@workspace/db"
import { chartMock } from "@/test/yahoo-mock"
import { computeAccountSeries } from "./series"
import { honoApp } from "@/app"
import { signAccessToken } from "@/modules/auth/core/jwt"
import { ACCESS_TOKEN_COOKIE } from "@/modules/auth/core/cookies"
import { env } from "@workspace/env/api"

let organizationId: string
let userId: string

beforeAll(async () => {
  await createTestApp()
})

afterAll(() => closeTestApp())

beforeEach(async () => {
  await truncateAll()
  const result = await signupUser()
  organizationId = result.accessToken.organizationId
  userId = result.accessToken.sub
})

function daysAgo(n: number): Date {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - n)
  return d
}

async function insertAccount(opts: {
  name: string
  type: "bank" | "cash" | "brokerage"
  currency: string
  initialBalance: number
}) {
  const [row] = await db
    .insert(accounts)
    .values({
      organizationId,
      name: opts.name,
      type: opts.type,
      currency: opts.currency,
      initialBalance: opts.initialBalance,
    })
    .returning()
  return row
}

async function insertTransaction(opts: {
  accountId: string
  amount: number
  date: Date
}) {
  await db.insert(transactions).values({
    organizationId,
    accountId: opts.accountId,
    amount: opts.amount,
    date: opts.date,
  })
}

describe("computeAccountSeries — cash", () => {
  it("returns 30 flat points at initialBalance for an account with no flows", async () => {
    const acc = await insertAccount({
      name: "Main",
      type: "bank",
      currency: "USD",
      initialBalance: 1000,
    })

    const result = await computeAccountSeries(organizationId, userId, 30)

    const series = result.find((s) => s.accountId === acc.id)
    expect(series).toBeDefined()
    expect(series!.points.length).toBe(30)
    expect(series!.points.every((p) => p.balance === 1000)).toBe(true)
  })

  it("reflects a deposit mid-window", async () => {
    const acc = await insertAccount({
      name: "Main",
      type: "bank",
      currency: "USD",
      initialBalance: 100,
    })
    await insertTransaction({
      accountId: acc.id,
      amount: 50,
      date: daysAgo(5),
    })

    const result = await computeAccountSeries(organizationId, userId, 30)
    const series = result.find((s) => s.accountId === acc.id)!
    const last = series.points[series.points.length - 1]
    const five = series.points[series.points.length - 6] // index from end: today is last (idx 29), -5 is idx 24
    const six = series.points[series.points.length - 7]

    expect(last.balance).toBe(150)
    expect(five.balance).toBe(150) // day of deposit and later
    expect(six.balance).toBe(100) // day before deposit
  })

  it("returns initialBalance for days before a mid-window deposit (account predates the window)", async () => {
    const acc = await insertAccount({
      name: "Main",
      type: "bank",
      currency: "USD",
      initialBalance: 200,
    })
    await insertTransaction({
      accountId: acc.id,
      amount: -30,
      date: daysAgo(15),
    })

    const result = await computeAccountSeries(organizationId, userId, 30)
    const series = result.find((s) => s.accountId === acc.id)!
    expect(series.points[0].balance).toBe(200) // day -29
    expect(series.points[series.points.length - 1].balance).toBe(170) // today
  })

  it("orders points oldest-first with ISO date keys", async () => {
    const acc = await insertAccount({
      name: "Main",
      type: "cash",
      currency: "USD",
      initialBalance: 0,
    })

    const result = await computeAccountSeries(organizationId, userId, 30)
    const points = result.find((s) => s.accountId === acc.id)!.points

    for (let i = 1; i < points.length; i++) {
      expect(points[i].date > points[i - 1].date).toBe(true)
    }
    expect(/^\d{4}-\d{2}-\d{2}$/.test(points[0].date)).toBe(true)
  })

  it("respects pre-window flows in the starting balance", async () => {
    const acc = await insertAccount({
      name: "Main",
      type: "bank",
      currency: "USD",
      initialBalance: 100,
    })
    // 60 days ago — well before the window
    await insertTransaction({
      accountId: acc.id,
      amount: 250,
      date: daysAgo(60),
    })

    const result = await computeAccountSeries(organizationId, userId, 30)
    const series = result.find((s) => s.accountId === acc.id)!
    // Day -29 balance must already include the pre-window deposit
    expect(series.points[0].balance).toBe(350)
  })
})

async function insertInstrument(opts: {
  symbol: string
  currency: string
  lastPrice: number
}) {
  const [row] = await db
    .insert(instruments)
    .values({
      symbol: opts.symbol,
      name: opts.symbol,
      exchange: null,
      currency: opts.currency,
      lastPrice: opts.lastPrice,
      lastPricedAt: new Date(),
    })
    .returning()
  return row
}

async function insertTrade(opts: {
  accountId: string
  instrumentId: string
  type: "buy" | "sell" | "dividend"
  quantity: number | null
  price: number | null
  amount: number
  date: Date
}) {
  await db.insert(trades).values({
    organizationId,
    accountId: opts.accountId,
    instrumentId: opts.instrumentId,
    type: opts.type,
    quantity: opts.quantity,
    price: opts.price,
    amount: opts.amount,
    date: opts.date,
  })
}

async function seedPrice(
  instrumentId: string,
  date: string,
  close: number,
) {
  await db
    .insert(instrumentPrices)
    .values({ instrumentId, date, close })
}

describe("computeAccountSeries — brokerage", () => {
  beforeEach(() => {
    chartMock.mockReset()
    // Suppress the lazy backfill by returning empty quotes.
    chartMock.mockResolvedValue({ quotes: [] })
  })

  it("values cash + holdings on each day, FX-converts to account currency", async () => {
    const acc = await insertAccount({
      name: "Brokerage",
      type: "brokerage",
      currency: "USD",
      initialBalance: 1000,
    })
    const inst = await insertInstrument({
      symbol: "AAPL",
      currency: "USD",
      lastPrice: 100,
    })
    // Buy 10 shares 15 days ago at $50; cash impact -500.
    await insertTrade({
      accountId: acc.id,
      instrumentId: inst.id,
      type: "buy",
      quantity: 10,
      price: 50,
      amount: 500,
      date: daysAgo(15),
    })
    // Seed today's and 15-days-ago prices for forward-fill.
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const todayStr = today.toISOString().slice(0, 10)
    const d15 = new Date(today.getTime() - 15 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10)
    await seedPrice(inst.id, d15, 50)
    await seedPrice(inst.id, todayStr, 100)

    const result = await computeAccountSeries(organizationId, userId, 30)
    const series = result.find((s) => s.accountId === acc.id)!

    // Day -29: pre-window, no trades yet, no holdings. Cash = 1000.
    expect(series.points[0].balance).toBe(1000)
    // Day of buy (-15): cash = 500, holdings = 10 * 50 = 500. Total 1000.
    expect(series.points[series.points.length - 16].balance).toBeCloseTo(1000)
    // Today: cash = 500, holdings = 10 * 100 = 1000. Total 1500.
    expect(series.points[series.points.length - 1].balance).toBeCloseTo(1500)
  })

  it("forward-fills missing prices from the most recent prior date", async () => {
    const acc = await insertAccount({
      name: "Brokerage",
      type: "brokerage",
      currency: "USD",
      initialBalance: 0,
    })
    const inst = await insertInstrument({
      symbol: "AAPL",
      currency: "USD",
      lastPrice: 100,
    })
    await insertTrade({
      accountId: acc.id,
      instrumentId: inst.id,
      type: "buy",
      quantity: 1,
      price: 50,
      amount: 50,
      date: daysAgo(20),
    })
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const d20 = new Date(today.getTime() - 20 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10)
    // Only one price row. All subsequent days should forward-fill to 50.
    await seedPrice(inst.id, d20, 50)

    const result = await computeAccountSeries(organizationId, userId, 30)
    const series = result.find((s) => s.accountId === acc.id)!
    // Today: cash = -50, holdings = 1 * 50 = 50. Total 0.
    expect(series.points[series.points.length - 1].balance).toBeCloseTo(0)
  })

  it("returns 0 holdings when no price rows exist (Yahoo soft-fail)", async () => {
    const acc = await insertAccount({
      name: "Brokerage",
      type: "brokerage",
      currency: "USD",
      initialBalance: 0,
    })
    const inst = await insertInstrument({
      symbol: "AAPL",
      currency: "USD",
      lastPrice: 100,
    })
    await insertTrade({
      accountId: acc.id,
      instrumentId: inst.id,
      type: "buy",
      quantity: 1,
      price: 100,
      amount: 100,
      date: daysAgo(10),
    })

    const result = await computeAccountSeries(organizationId, userId, 30)
    const series = result.find((s) => s.accountId === acc.id)!
    // Cash impact only: today = -100, no holdings valuation possible.
    expect(series.points[series.points.length - 1].balance).toBeCloseTo(-100)
  })

  it("converts holdings to account currency using the exchange_rates table", async () => {
    const acc = await insertAccount({
      name: "Brokerage EUR",
      type: "brokerage",
      currency: "EUR",
      initialBalance: 0,
    })
    const inst = await insertInstrument({
      symbol: "AAPL",
      currency: "USD",
      lastPrice: 100,
    })
    await insertTrade({
      accountId: acc.id,
      instrumentId: inst.id,
      type: "buy",
      quantity: 1,
      price: 100,
      amount: 100,
      date: daysAgo(5),
    })
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const todayStr = today.toISOString().slice(0, 10)
    await seedPrice(inst.id, todayStr, 100)

    // Seed FX: 1 USD = 0.9 EUR for today.
    await db.insert(exchangeRates).values({
      date: todayStr,
      base: "USD",
      target: "EUR",
      rate: 0.9,
    })

    const result = await computeAccountSeries(organizationId, userId, 30)
    const series = result.find((s) => s.accountId === acc.id)!

    // Cash impact: trade amount is in account currency by convention, so -100 EUR.
    // Holdings: 1 share * $100 USD * 0.9 (USD->EUR) = 90 EUR.
    // Total today: -100 + 90 = -10 EUR.
    expect(series.points[series.points.length - 1].balance).toBeCloseTo(-10)
  })
})

function buildCookie(payload: {
  sub: string
  email: string
  organizationId: string
}): string {
  const jwt = signAccessToken(payload, env.JWT_SECRET, env.JWT_EXPIRATION)
  return `${ACCESS_TOKEN_COOKIE}=${jwt}`
}

describe("GET /accounts/series", () => {
  it("requires auth", async () => {
    const res = await honoApp.request("/accounts/series?days=30")
    expect(res.status).toBe(401)
  })

  it("returns the series for every account in the org", async () => {
    const acc = await insertAccount({
      name: "Main",
      type: "bank",
      currency: "USD",
      initialBalance: 100,
    })
    const cookie = buildCookie({
      sub: userId,
      email: "x@y.z",
      organizationId,
    })
    const res = await honoApp.request("/accounts/series?days=30", {
      headers: { cookie },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as Array<{
      accountId: string
      currency: string
      points: Array<{ date: string; balance: number }>
    }>
    expect(body.length).toBe(1)
    expect(body[0].accountId).toBe(acc.id)
    expect(body[0].currency).toBe("USD")
    expect(body[0].points.length).toBe(30)
  })

  it("defaults to 30 days when no query param", async () => {
    await insertAccount({
      name: "Main",
      type: "bank",
      currency: "USD",
      initialBalance: 0,
    })
    const cookie = buildCookie({
      sub: userId,
      email: "x@y.z",
      organizationId,
    })
    const res = await honoApp.request("/accounts/series", {
      headers: { cookie },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as Array<{
      points: Array<{ date: string; balance: number }>
    }>
    expect(body[0].points.length).toBe(30)
  })

  it("rejects days=0", async () => {
    const cookie = buildCookie({
      sub: userId,
      email: "x@y.z",
      organizationId,
    })
    const res = await honoApp.request("/accounts/series?days=0", {
      headers: { cookie },
    })
    expect(res.status).toBe(400)
  })

  it("rejects days=91", async () => {
    const cookie = buildCookie({
      sub: userId,
      email: "x@y.z",
      organizationId,
    })
    const res = await honoApp.request("/accounts/series?days=91", {
      headers: { cookie },
    })
    expect(res.status).toBe(400)
  })
})
