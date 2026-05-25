import { and, asc, eq, inArray, lte, sql } from "drizzle-orm"
import {
  accounts,
  instrumentPrices,
  instruments,
  trades,
  transactions,
} from "@workspace/db"
import type {
  AccountSeriesItem,
  AccountSeriesResponse,
  WalletSeriesItem,
} from "@workspace/api-contract"
import { db } from "@/db"
import { getRate } from "@/modules/exchange-rates/service"
import { ensureHistoricalPrices } from "@/modules/investments/instruments/service"
import { getCurrentUser } from "@/modules/users/service"

const ONE_DAY_MS = 24 * 60 * 60 * 1000

function todayUTC(): Date {
  const now = new Date()
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  )
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function buildWindow(days: number): string[] {
  const today = todayUTC()
  const out: string[] = []
  for (let i = days - 1; i >= 0; i--) {
    out.push(isoDate(new Date(today.getTime() - i * ONE_DAY_MS)))
  }
  return out
}

interface AccountRow {
  id: string
  type: string
  currency: string
  initialBalance: number
  walletId: string | null
}

function tradeCashImpact(t: {
  type: string
  amount: number
  withheldTax: number | null
}): number {
  if (t.type === "buy") return -t.amount
  if (t.type === "sell") return t.amount
  if (t.type === "dividend") return t.amount + (t.withheldTax ?? 0)
  return 0
}

function tradeQtyImpact(t: {
  type: string
  quantity: number | null
}): number {
  if (t.quantity == null) return 0
  if (t.type === "buy") return t.quantity
  if (t.type === "sell") return -t.quantity
  return 0
}

// Carry the nearest known cross-currency rate across the window. getRate
// returns 1 for a pair of different currencies when a day's snapshot lacks the
// target, which would otherwise sum a foreign pocket 1:1 into home currency for
// that day. A missing day (1) reuses the closest prior rate, and leading gaps
// reuse the first known rate. If no real rate exists at all, the 1s are kept.
export function carryForwardRates(rates: number[]): number[] {
  const out = [...rates]
  let lastReal: number | null = null
  for (let i = 0; i < out.length; i++) {
    if (out[i] !== 1) lastReal = out[i]
    else if (lastReal !== null) out[i] = lastReal
  }
  let firstReal: number | null = null
  for (let i = out.length - 1; i >= 0; i--) {
    if (out[i] !== 1) firstReal = out[i]
    else if (firstReal !== null) out[i] = firstReal
  }
  return out
}

export async function computeAccountSeries(
  organizationId: string,
  userId: string,
  days: number,
): Promise<AccountSeriesResponse> {
  const window = buildWindow(days)
  const windowStartIso = window[0]
  const today = todayUTC()
  const tomorrow = new Date(today.getTime() + ONE_DAY_MS)

  const accountRows: AccountRow[] = await db
    .select({
      id: accounts.id,
      type: accounts.type,
      currency: accounts.currency,
      initialBalance: accounts.initialBalance,
      walletId: accounts.walletId,
    })
    .from(accounts)
    .where(eq(accounts.organizationId, organizationId))
    .orderBy(accounts.name)

  if (accountRows.length === 0) return { accounts: [], wallets: [] }

  const accountIds = accountRows.map((a) => a.id)

  const txRows = await db
    .select({
      accountId: transactions.accountId,
      date: sql<string>`(${transactions.date} AT TIME ZONE 'UTC')::date`,
      amount: transactions.amount,
    })
    .from(transactions)
    .where(
      and(
        inArray(transactions.accountId, accountIds),
        lte(transactions.date, tomorrow),
      ),
    )

  const tradeRows = await db
    .select({
      accountId: trades.accountId,
      instrumentId: trades.instrumentId,
      type: trades.type,
      amount: trades.amount,
      withheldTax: trades.withheldTax,
      quantity: trades.quantity,
      date: sql<string>`(${trades.date} AT TIME ZONE 'UTC')::date`,
    })
    .from(trades)
    .where(
      and(
        inArray(trades.accountId, accountIds),
        lte(trades.date, tomorrow),
      ),
    )

  // Per-account cash deltas (in account currency) and pre-window cash total.
  const cashDeltas = new Map<string, Map<string, number>>()
  const cashPreWindow = new Map<string, number>()
  for (const acc of accountRows) {
    cashDeltas.set(acc.id, new Map())
    cashPreWindow.set(acc.id, 0)
  }
  function addCash(accountId: string, date: string, amount: number) {
    if (date < windowStartIso) {
      cashPreWindow.set(accountId, (cashPreWindow.get(accountId) ?? 0) + amount)
    } else {
      const m = cashDeltas.get(accountId)!
      m.set(date, (m.get(date) ?? 0) + amount)
    }
  }
  for (const t of txRows) addCash(t.accountId, t.date, t.amount)
  for (const t of tradeRows) addCash(t.accountId, t.date, tradeCashImpact(t))

  // Per (accountId, instrumentId) quantity deltas-by-date + pre-window qty.
  type Key = string // `${accountId}:${instrumentId}`
  function qkey(a: string, i: string): Key {
    return `${a}:${i}`
  }
  const qtyDeltas = new Map<Key, Map<string, number>>()
  const qtyPreWindow = new Map<Key, number>()
  const accountInstruments = new Map<string, Set<string>>() // accountId -> instrumentIds
  for (const t of tradeRows) {
    const dq = tradeQtyImpact(t)
    if (dq === 0) continue
    const k = qkey(t.accountId, t.instrumentId)
    if (!accountInstruments.has(t.accountId))
      accountInstruments.set(t.accountId, new Set())
    accountInstruments.get(t.accountId)!.add(t.instrumentId)
    if (t.date < windowStartIso) {
      qtyPreWindow.set(k, (qtyPreWindow.get(k) ?? 0) + dq)
    } else {
      if (!qtyDeltas.has(k)) qtyDeltas.set(k, new Map())
      const m = qtyDeltas.get(k)!
      m.set(t.date, (m.get(t.date) ?? 0) + dq)
    }
  }

  // Backfill historical prices for any instrument held by any brokerage account.
  const instrumentIds = new Set<string>()
  for (const acc of accountRows) {
    if (acc.type !== "brokerage") continue
    const insts = accountInstruments.get(acc.id)
    if (insts) for (const i of insts) instrumentIds.add(i)
  }
  if (instrumentIds.size > 0) {
    await ensureHistoricalPrices([...instrumentIds], days)
  }

  // Pull stored prices + instrument currencies.
  let priceRows: Array<{ instrumentId: string; date: string; close: number }> =
    []
  const instrumentCurrency = new Map<string, string>()
  if (instrumentIds.size > 0) {
    priceRows = await db
      .select({
        instrumentId: instrumentPrices.instrumentId,
        date: instrumentPrices.date,
        close: instrumentPrices.close,
      })
      .from(instrumentPrices)
      .where(inArray(instrumentPrices.instrumentId, [...instrumentIds]))
      .orderBy(asc(instrumentPrices.date))

    const instRows = await db
      .select({ id: instruments.id, currency: instruments.currency })
      .from(instruments)
      .where(inArray(instruments.id, [...instrumentIds]))
    for (const r of instRows) instrumentCurrency.set(r.id, r.currency)
  }

  // priceByInstrument: instrumentId -> sorted Array<[date, close]>.
  const priceByInstrument = new Map<string, Array<[string, number]>>()
  for (const row of priceRows) {
    if (!priceByInstrument.has(row.instrumentId))
      priceByInstrument.set(row.instrumentId, [])
    priceByInstrument.get(row.instrumentId)!.push([row.date, row.close])
  }

  // Forward-fill helper. `series` is sorted ASC by date.
  function forwardFill(
    series: Array<[string, number]> | undefined,
    date: string,
  ): number {
    if (!series || series.length === 0) return 0
    let lo = 0
    let hi = series.length - 1
    let answer = -1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (series[mid][0] <= date) {
        answer = mid
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }
    return answer === -1 ? 0 : series[answer][1]
  }

  const { homeCurrency } = await getCurrentUser(userId)
  const hasPockets = accountRows.some((a) => a.walletId !== null)

  // Pre-warm FX: for every (instrument.currency, account.currency, date) we'll
  // touch, plus (pocket.currency, home, date) for wallet aggregation.
  const fxByDate = new Map<string, number>() // `${from}:${to}:${date}` -> rate
  const fxKeys: Array<{ from: string; to: string; date: string }> = []
  for (const acc of accountRows) {
    if (acc.type !== "brokerage") continue
    const insts = accountInstruments.get(acc.id)
    if (!insts) continue
    for (const instId of insts) {
      const from = instrumentCurrency.get(instId)
      if (!from) continue
      if (from === acc.currency) continue
      for (const date of window) {
        const k = `${from}:${acc.currency}:${date}`
        if (!fxByDate.has(k)) {
          fxByDate.set(k, 0) // placeholder; will fill below
          fxKeys.push({ from, to: acc.currency, date })
        }
      }
    }
  }
  for (const acc of accountRows) {
    if (acc.walletId === null) continue
    if (acc.currency === homeCurrency) continue
    for (const date of window) {
      const k = `${acc.currency}:${homeCurrency}:${date}`
      if (!fxByDate.has(k)) {
        fxByDate.set(k, 0)
        fxKeys.push({ from: acc.currency, to: homeCurrency, date })
      }
    }
  }
  const usedCurrencies = [
    ...new Set([
      ...accountRows.map((a) => a.currency),
      ...instrumentCurrency.values(),
      homeCurrency,
    ]),
  ]
  await Promise.all(
    fxKeys.map(async ({ from, to, date }) => {
      try {
        const rate = await getRate(
          from,
          to,
          new Date(`${date}T00:00:00Z`),
          usedCurrencies,
        )
        fxByDate.set(`${from}:${to}:${date}`, rate)
      } catch (err) {
        console.warn(
          `FX preheat failed for ${from}->${to} on ${date}: ${(err as Error).message}`,
        )
        fxByDate.set(`${from}:${to}:${date}`, 1)
      }
    }),
  )

  // Smooth pocket→home rates over the window so a day with no published rate
  // reuses the nearest known one rather than collapsing the pocket to 1:1.
  const pocketCurrencies = new Set(
    accountRows
      .filter((a) => a.walletId !== null && a.currency !== homeCurrency)
      .map((a) => a.currency),
  )
  for (const cur of pocketCurrencies) {
    const filled = carryForwardRates(
      window.map((date) => fxByDate.get(`${cur}:${homeCurrency}:${date}`) ?? 1),
    )
    window.forEach((date, i) => {
      fxByDate.set(`${cur}:${homeCurrency}:${date}`, filled[i])
    })
  }

  function fx(from: string, to: string, date: string): number {
    if (from === to) return 1
    return fxByDate.get(`${from}:${to}:${date}`) ?? 1
  }

  type ComputedSeries = AccountSeriesItem & { walletId: string | null }

  const allSeries: ComputedSeries[] = accountRows.map((acc) => {
    const deltas = cashDeltas.get(acc.id)!
    let cash = acc.initialBalance + (cashPreWindow.get(acc.id) ?? 0)

    const insts = accountInstruments.get(acc.id) ?? new Set<string>()
    // Initialize qty for each instrument from pre-window.
    const qty = new Map<string, number>()
    for (const instId of insts) {
      qty.set(instId, qtyPreWindow.get(qkey(acc.id, instId)) ?? 0)
    }

    const points = window.map((date) => {
      cash += deltas.get(date) ?? 0
      // Apply same-day qty deltas before valuation.
      for (const instId of insts) {
        const dq = qtyDeltas.get(qkey(acc.id, instId))?.get(date) ?? 0
        if (dq !== 0) qty.set(instId, (qty.get(instId) ?? 0) + dq)
      }

      let holdings = 0
      if (acc.type === "brokerage") {
        for (const instId of insts) {
          const q = qty.get(instId) ?? 0
          if (q === 0) continue
          const price = forwardFill(priceByInstrument.get(instId), date)
          if (price === 0) continue
          const instCcy = instrumentCurrency.get(instId)
          if (!instCcy) continue
          holdings += q * price * fx(instCcy, acc.currency, date)
        }
      }

      return { date, balance: cash + holdings }
    })

    return {
      accountId: acc.id,
      currency: acc.currency,
      walletId: acc.walletId,
      points,
    }
  })

  const accountSeries: AccountSeriesItem[] = []
  const pocketSeriesByWallet = new Map<string, ComputedSeries[]>()
  for (const s of allSeries) {
    if (s.walletId === null) {
      accountSeries.push({
        accountId: s.accountId,
        currency: s.currency,
        points: s.points,
      })
    } else {
      const arr = pocketSeriesByWallet.get(s.walletId) ?? []
      arr.push(s)
      pocketSeriesByWallet.set(s.walletId, arr)
    }
  }

  const walletSeries: WalletSeriesItem[] = []
  if (hasPockets) {
    for (const [walletId, pockets] of pocketSeriesByWallet) {
      const points = window.map((date, idx) => {
        let total = 0
        for (const p of pockets) {
          total += p.points[idx].balance * fx(p.currency, homeCurrency, date)
        }
        return { date, balance: total }
      })
      walletSeries.push({ walletId, currency: homeCurrency, points })
    }
  }

  return { accounts: accountSeries, wallets: walletSeries }
}
