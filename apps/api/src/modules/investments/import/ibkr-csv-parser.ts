import { groupDividends } from "./group-dividends"
import { parseCashTxnsSection } from "./parse-cash-txns-section"
import { parseTradesSection } from "./parse-trades-section"
import { splitSections } from "./split-sections"
import type { ParsedImport } from "./types"

/** Identifies which IBKR section a raw section is based on its header columns. */
function classify(
  header: string[]
): "trades" | "cash_transactions" | "unknown" {
  if (header.includes("TransactionType") && header.includes("Buy/Sell"))
    return "trades"
  if (
    header.includes("Type") &&
    header.includes("Amount") &&
    header.includes("Date/Time")
  )
    return "cash_transactions"
  return "unknown"
}

export function parseIbkrCsv(csv: string): ParsedImport {
  const sections = splitSections(csv)

  const result: ParsedImport = {
    clientAccountId: null,
    events: [],
    deposits: [],
    skipped: [],
    errors: [],
  }

  for (const section of sections) {
    const kind = classify(section.header)
    if (result.clientAccountId === null && section.rows.length > 0) {
      const first = section.rows[0]
      const acc = first["ClientAccountID"]
      if (acc) result.clientAccountId = acc
    }

    if (kind === "trades") {
      const { events, errors } = parseTradesSection(section)
      result.events.push(...events)
      result.errors.push(...errors)
    } else if (kind === "cash_transactions") {
      const cash = parseCashTxnsSection(section)
      result.deposits.push(...cash.deposits)
      result.skipped.push(...cash.skipped)
      result.errors.push(...cash.errors)
      const grouped = groupDividends(cash.dividends, cash.taxes)
      result.events.push(...grouped.events)
      result.errors.push(...grouped.errors)
    } else {
      result.errors.push({
        line: section.headerLine,
        reason: `Unrecognized section header (starts with ${section.header.slice(0, 3).join(",")})`,
        raw: section.header.join(","),
      })
    }
  }

  return result
}
