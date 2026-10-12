import { beforeAll, afterAll, beforeEach, describe, it, expect } from "bun:test"
import {
  closeTestApp,
  createTestApp,
  signupUser,
  truncateAll,
} from "@/test/setup"
import { db } from "@/db"
import {
  accounts,
  exchangeRates,
  instrumentPrices,
  instruments,
  trades,
  transactions,
  wallets,
} from "@workspace/db"
import { chartMock } from "@/test/yahoo-mock"
import { carryForwardRates, computeAccountSeries } from "./series"
import { honoApp } from "@/app"

let organizationId: string
let userId: string
let cookie: string

beforeAll(async () => {
  await createTestApp()
})

afterAll(() => closeTestApp())

beforeEach(async () => {
  await truncateAll()
  const result = await signupUser()
  organizationId = result.organizationId
  userId = result.userId
  cookie = result.cookie
})

function daysAgo(n: number): Date {
  const d = new Date()
  d.setUTCHours(0, 0, 0, 0)
  d.setUTCDate(d.getUTCDate() - n)
  return d
}

async function insertAccount(opts: {
  name: string
  type: "bank" | "brokerage" | "wallet"
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

    const series = result.accounts.find((s) => s.accountId === acc.id)
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
    const series = result.accounts.find((s) => s.accountId === acc.id)!
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
    const series = result.accounts.find((s) => s.accountId === acc.id)!
    expect(series.points[0].balance).toBe(200) // day -29
    expect(series.points[series.points.length - 1].balance).toBe(170) // today
  })

  it("orders points oldest-first with ISO date keys", async () => {
    const acc = await insertAccount({
      name: "Main",
      type: "bank",
      currency: "USD",
      initialBalance: 0,
    })

    const result = await computeAccountSeries(organizationId, userId, 30)
    const points = result.accounts.find((s) => s.accountId === acc.id)!.points

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
    const series = result.accounts.find((s) => s.accountId === acc.id)!
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

async function seedPrice(instrumentId: string, date: string, close: number) {
  await db.insert(instrumentPrices).values({ instrumentId, date, close })
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
    const series = result.accounts.find((s) => s.accountId === acc.id)!

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
    const series = result.accounts.find((s) => s.accountId === acc.id)!
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
    const series = result.accounts.find((s) => s.accountId === acc.id)!
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
    const series = result.accounts.find((s) => s.accountId === acc.id)!

    // Cash impact: trade amount is in account currency by convention, so -100 EUR.
    // Holdings: 1 share * $100 USD * 0.9 (USD->EUR) = 90 EUR.
    // Total today: -100 + 90 = -10 EUR.
    expect(series.points[series.points.length - 1].balance).toBeCloseTo(-10)
  })
})

async function insertWallet(name: string): Promise<string> {
  const [row] = await db
    .insert(wallets)
    .values({ organizationId, name })
    .returning()
  return row.id
}

async function insertPocket(opts: {
  walletId: string
  currency: string
  initialBalance: number
}) {
  const [row] = await db
    .insert(accounts)
    .values({
      organizationId,
      walletId: opts.walletId,
      name: "pocket",
      type: "wallet",
      currency: opts.currency,
      initialBalance: opts.initialBalance,
    })
    .returning()
  return row
}

describe("computeAccountSeries — wallets", () => {
  it("excludes pocket accounts from accounts[] and groups them under wallets[]", async () => {
    const standalone = await insertAccount({
      name: "Checking",
      type: "bank",
      currency: "UAH",
      initialBalance: 500,
    })
    const walletId = await insertWallet("Cash")
    await insertPocket({ walletId, currency: "UAH", initialBalance: 1000 })

    const result = await computeAccountSeries(organizationId, userId, 30)

    expect(result.accounts.map((s) => s.accountId)).toEqual([standalone.id])
    expect(result.wallets.length).toBe(1)
    expect(result.wallets[0].walletId).toBe(walletId)
  })

  it("returns a constant home-currency series for a single home-currency pocket", async () => {
    // Home currency is UAH by default. Pocket also UAH → no FX needed.
    const walletId = await insertWallet("Cash")
    await insertPocket({ walletId, currency: "UAH", initialBalance: 1500 })

    const result = await computeAccountSeries(organizationId, userId, 30)
    const ws = result.wallets[0]
    expect(ws.currency).toBe("UAH")
    expect(ws.points.length).toBe(30)
    expect(ws.points.every((p) => p.balance === 1500)).toBe(true)
  })

  it("FX-converts each pocket to home currency on today's series point", async () => {
    // Home is UAH. Pockets: 1000 USD + 200 EUR.
    const walletId = await insertWallet("Cash")
    await insertPocket({ walletId, currency: "USD", initialBalance: 1000 })
    await insertPocket({ walletId, currency: "EUR", initialBalance: 200 })

    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const todayStr = today.toISOString().slice(0, 10)
    await db.insert(exchangeRates).values([
      { date: todayStr, base: "USD", target: "UAH", rate: 40 },
      { date: todayStr, base: "EUR", target: "UAH", rate: 44 },
    ])

    const result = await computeAccountSeries(organizationId, userId, 30)
    const ws = result.wallets[0]
    // 1000 * 40 + 200 * 44 = 40000 + 8800 = 48800
    expect(ws.points[ws.points.length - 1].balance).toBeCloseTo(48800)
  })

  it("reflects mid-window pocket transactions in wallet series", async () => {
    const walletId = await insertWallet("Cash")
    const pocket = await insertPocket({
      walletId,
      currency: "UAH",
      initialBalance: 1000,
    })
    await insertTransaction({
      accountId: pocket.id,
      amount: 500,
      date: daysAgo(5),
    })

    const result = await computeAccountSeries(organizationId, userId, 30)
    const ws = result.wallets[0]
    expect(ws.points[ws.points.length - 7].balance).toBe(1000) // day before deposit
    expect(ws.points[ws.points.length - 6].balance).toBe(1500) // deposit day
    expect(ws.points[ws.points.length - 1].balance).toBe(1500) // today
  })
})

describe("carryForwardRates", () => {
  it("carries the prior rate into a middle gap (1 = missing)", () => {
    expect(carryForwardRates([40, 1, 42])).toEqual([40, 40, 42])
  })

  it("fills leading gaps with the first known rate", () => {
    expect(carryForwardRates([1, 1, 42, 1])).toEqual([42, 42, 42, 42])
  })

  it("leaves an all-missing series untouched (no rate to carry)", () => {
    expect(carryForwardRates([1, 1, 1])).toEqual([1, 1, 1])
  })

  it("does not alter a fully-populated series", () => {
    expect(carryForwardRates([40, 41, 42])).toEqual([40, 41, 42])
  })
})

describe("GET /accounts/series", () => {
  it("requires auth", async () => {
    const res = await honoApp.request("/accounts/series?days=30")
    expect(res.status).toBe(401)
  })

  it("returns the series for every account in the org under accounts[]", async () => {
    const acc = await insertAccount({
      name: "Main",
      type: "bank",
      currency: "USD",
      initialBalance: 100,
    })
    const res = await honoApp.request("/accounts/series?days=30", {
      headers: { cookie },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      accounts: Array<{
        accountId: string
        currency: string
        points: Array<{ date: string; balance: number }>
      }>
      wallets: Array<unknown>
    }
    expect(body.accounts.length).toBe(1)
    expect(body.wallets).toEqual([])
    expect(body.accounts[0].accountId).toBe(acc.id)
    expect(body.accounts[0].currency).toBe("USD")
    expect(body.accounts[0].points.length).toBe(30)
  })

  it("defaults to 30 days when no query param", async () => {
    await insertAccount({
      name: "Main",
      type: "bank",
      currency: "USD",
      initialBalance: 0,
    })
    const res = await honoApp.request("/accounts/series", {
      headers: { cookie },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      accounts: Array<{ points: Array<unknown> }>
    }
    expect(body.accounts[0].points.length).toBe(30)
  })

  it("rejects days=0", async () => {
    const res = await honoApp.request("/accounts/series?days=0", {
      headers: { cookie },
    })
    expect(res.status).toBe(400)
  })

  it("rejects days=91", async () => {
    const res = await honoApp.request("/accounts/series?days=91", {
      headers: { cookie },
    })
    expect(res.status).toBe(400)
  })
})
