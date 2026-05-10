import type { RawSection } from "./split-sections"
import type { ParsedDeposit, RowError, SkippedRow } from "./types"

/**
 * Rows are kept as their raw dicts here because grouping needs the original fields.
 * The `line` field carries the original CSV line number for error reporting.
 * Unknown columns return `string` via the index signature.
 */
export type CashTxnRow = {
  [key: string]: string | number
  line: number
}

export interface CashTxnsResult {
  dividends: CashTxnRow[]
  taxes: CashTxnRow[]
  deposits: ParsedDeposit[]
  skipped: SkippedRow[]
  errors: RowError[]
}

const DIVIDEND_TYPES = new Set(["Dividends", "Payment In Lieu Of Dividends"])
const TAX_TYPES = new Set(["Withholding Tax"])
const DEPOSIT_TYPES = new Set(["Deposits/Withdrawals"])

export function parseCashTxnsSection(section: RawSection): CashTxnsResult {
  const dividends: CashTxnRow[] = []
  const taxes: CashTxnRow[] = []
  const deposits: ParsedDeposit[] = []
  const skipped: SkippedRow[] = []
  const errors: RowError[] = []

  section.rows.forEach((row, i) => {
    const line = section.rowLines[i]
    const type = row["Type"]

    if (DIVIDEND_TYPES.has(type)) {
      dividends.push({ ...row, line })
    } else if (TAX_TYPES.has(type)) {
      taxes.push({ ...row, line })
    } else if (DEPOSIT_TYPES.has(type)) {
      const parsed = parseDepositRow(row, line)
      if (parsed.kind === "ok") {
        deposits.push(parsed.deposit)
      } else {
        errors.push(parsed.error)
      }
    } else {
      errors.push({
        line,
        reason: `Unsupported cash transaction Type: ${type || "(empty)"}`,
        raw: Object.values(row).join(","),
      })
    }
  })

  return { dividends, taxes, deposits, skipped, errors }
}

function parseDepositRow(
  row: Record<string, string | number>,
  line: number
): { kind: "ok"; deposit: ParsedDeposit } | { kind: "error"; error: RowError } {
  const amount = Number(row["Amount"] ?? 0)
  if (!Number.isFinite(amount) || amount === 0) {
    return {
      kind: "error",
      error: {
        line,
        reason: `Deposit row has invalid Amount: ${row["Amount"]}`,
        raw: Object.values(row).join(","),
      },
    }
  }
  const date = parseIbkrDateOnly(String(row["Date/Time"] ?? ""))
  if (!date) {
    return {
      kind: "error",
      error: {
        line,
        reason: `Deposit row has invalid Date/Time: ${row["Date/Time"]}`,
        raw: Object.values(row).join(","),
      },
    }
  }
  const externalId = String(row["TransactionID"] ?? "").trim()
  if (!externalId) {
    return {
      kind: "error",
      error: {
        line,
        reason: "Deposit row is missing TransactionID",
        raw: Object.values(row).join(","),
      },
    }
  }
  return {
    kind: "ok",
    deposit: {
      amount,
      date,
      currency: (row["CurrencyPrimary"] as string) || "USD",
      externalSource: "ibkr_flex_query",
      externalId,
      externalMetadata: {
        section: "cash_transactions",
        type: "Deposits/Withdrawals",
        description: (row["Description"] as string) || "",
        settleDate: formatIbkrDate(row["SettleDate"] as string | undefined),
        clientAccountId: (row["ClientAccountID"] as string) || null,
      },
    },
  }
}

function parseIbkrDateOnly(raw: string): Date | null {
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
