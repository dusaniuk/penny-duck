import type { CashTxnRow } from "./parse-cash-txns-section"
import type { DividendMetadata, ParsedEvent, RowError } from "./types"

interface Result {
  events: ParsedEvent[]
  errors: RowError[]
}

/**
 * Groups dividend + withholding-tax rows by (Symbol, Date/Time). Each group
 * becomes one dividend event whose `amount` is Σ(dividend rows) and
 * `withheldTax` is Σ(tax rows). A group that has only tax rows (no matching
 * dividend) yields an error, not an event.
 */
export function groupDividends(
  dividendRows: CashTxnRow[],
  taxRows: CashTxnRow[]
): Result {
  const groups = new Map<string, { divs: CashTxnRow[]; taxes: CashTxnRow[] }>()

  for (const d of dividendRows) {
    const key = makeKey(String(d["Symbol"]), String(d["Date/Time"]))
    const g = groups.get(key) ?? { divs: [], taxes: [] }
    g.divs.push(d)
    groups.set(key, g)
  }
  for (const t of taxRows) {
    const key = makeKey(String(t["Symbol"]), String(t["Date/Time"]))
    const g = groups.get(key) ?? { divs: [], taxes: [] }
    g.taxes.push(t)
    groups.set(key, g)
  }

  const events: ParsedEvent[] = []
  const errors: RowError[] = []

  for (const [, g] of groups) {
    if (g.divs.length === 0) {
      g.taxes.forEach((t) =>
        errors.push({
          line: Number(t.line),
          reason: `Withholding tax with no matching dividend (${t["Symbol"]} @ ${t["Date/Time"]})`,
          raw: Object.values(t).join(","),
        })
      )
      continue
    }
    const first = g.divs[0]
    const amount = g.divs.reduce((s, d) => s + Number(d["Amount"] || 0), 0)
    const withheldTax = g.taxes.reduce((s, t) => s + Number(t["Amount"] || 0), 0)
    const date = parseIbkrDateTime(String(first["Date/Time"] ?? ""))
    if (!date) {
      errors.push({
        line: Number(first.line),
        reason: `Invalid Date/Time: ${first["Date/Time"]}`,
        raw: Object.values(first).join(","),
      })
      continue
    }

    const metadata: DividendMetadata = {
      section: "cash_transactions",
      dividendType: (first["DividendType"] as string) || null,
      paymentDate: formatIbkrDate(first["SettleDate"] as string | undefined),
      settleDate: formatIbkrDate(first["SettleDate"] as string | undefined),
      exDate: formatIbkrDate(first["ExDate"] as string | undefined),
      description: (first["Description"] as string) || "",
      clientAccountId: (first["ClientAccountID"] as string) || null,
      withholdingRows: g.taxes.length,
      actionId: (first["ActionID"] as string) || null,
    }

    events.push({
      kind: "dividend",
      symbol: String(first["Symbol"]),
      amount,
      withheldTax,
      date,
      currency: (first["CurrencyPrimary"] as string) || "USD",
      externalSource: "ibkr_flex_query",
      externalId: String(first["TransactionID"]),
      externalMetadata: metadata,
    })
  }

  return { events, errors }
}

function makeKey(symbol: string, dateTime: string): string {
  return `${symbol}::${dateTime}`
}

function parseIbkrDateTime(raw: string): Date | null {
  if (!raw) return null
  const clean = raw.includes(";") ? raw : `${raw};000000`
  const [d, t] = clean.split(";")
  if (d.length !== 8 || t.length !== 6) return null
  const iso = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}Z`
  const date = new Date(iso)
  return isNaN(date.getTime()) ? null : date
}

function formatIbkrDate(raw: string | undefined): string | null {
  if (!raw || raw.length !== 8) return null
  return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}`
}
