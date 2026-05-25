import type { Account, Wallet } from "@workspace/api-contract"

export type NetWorthGroup = "bank" | "brokerage" | "wallet"

export const NET_WORTH_GROUP_ORDER: Array<NetWorthGroup> = [
  "bank",
  "brokerage",
  "wallet",
]

export interface NetWorthRow {
  type: NetWorthGroup
  value: number
  pct: number
}

export interface NetWorthBreakdown {
  total: number
  currencyCount: number
  totalEntities: number
  rows: Array<NetWorthRow>
}

// A group row is shown when the group has at least one entity — not only when
// its balance is positive — so a zero-balance or overdrawn group still appears.
export function buildNetWorthBreakdown(
  accounts: Array<Account>,
  wallets: Array<Wallet>
): NetWorthBreakdown {
  const sums: Record<NetWorthGroup, number> = {
    bank: 0,
    brokerage: 0,
    wallet: 0,
  }
  const counts: Record<NetWorthGroup, number> = {
    bank: 0,
    brokerage: 0,
    wallet: 0,
  }
  let total = 0
  const currencies = new Set<string>()

  for (const a of accounts) {
    currencies.add(a.currency)
    total += a.homeBalance
    if (a.type === "bank" || a.type === "brokerage") {
      sums[a.type] += a.homeBalance
      counts[a.type] += 1
    }
  }
  for (const w of wallets) {
    for (const p of w.pockets) currencies.add(p.currency)
    total += w.totalHomeBalance
    sums.wallet += w.totalHomeBalance
    counts.wallet += 1
  }

  const rows = NET_WORTH_GROUP_ORDER.filter((t) => counts[t] > 0).map((t) => ({
    type: t,
    value: sums[t],
    pct: total > 0 ? (sums[t] / total) * 100 : 0,
  }))

  return {
    total,
    currencyCount: currencies.size,
    totalEntities: accounts.length + wallets.length,
    rows,
  }
}
