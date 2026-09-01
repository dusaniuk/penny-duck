import type { Account, Wallet } from "@workspace/api-contract"

export type AssetGroup = "bank" | "brokerage" | "wallet"
export type LiabilityGroup = "loan"
export type NetWorthGroup = AssetGroup | LiabilityGroup

export const ASSET_GROUP_ORDER: Array<AssetGroup> = [
  "bank",
  "brokerage",
  "wallet",
]
export const LIABILITY_GROUP_ORDER: Array<LiabilityGroup> = ["loan"]

export interface NetWorthRow {
  type: NetWorthGroup
  value: number
  pct: number
}

export interface NetWorthSection<T extends NetWorthGroup> {
  total: number
  rows: Array<NetWorthRow & { type: T }>
}

export interface NetWorthBreakdown {
  assets: NetWorthSection<AssetGroup>
  liabilities: NetWorthSection<LiabilityGroup>
  net: number
  currencyCount: number
  totalEntities: number
}

// A group row is shown when the group has at least one entity — not only when
// its balance is positive — so a zero-balance or overdrawn group still appears.
// Liability values are reported as positive amounts (owed), even though the
// underlying account `homeBalance` is negative.
export function buildNetWorthBreakdown(
  accounts: Array<Account>,
  wallets: Array<Wallet>
): NetWorthBreakdown {
  const assetSums: Record<AssetGroup, number> = {
    bank: 0,
    brokerage: 0,
    wallet: 0,
  }
  const assetCounts: Record<AssetGroup, number> = {
    bank: 0,
    brokerage: 0,
    wallet: 0,
  }
  const liabilitySums: Record<LiabilityGroup, number> = { loan: 0 }
  const liabilityCounts: Record<LiabilityGroup, number> = { loan: 0 }

  const currencies = new Set<string>()

  for (const a of accounts) {
    currencies.add(a.currency)
    if (a.type === "loan") {
      liabilitySums.loan += Math.abs(a.homeBalance)
      liabilityCounts.loan += 1
    } else if (a.type === "bank" || a.type === "brokerage") {
      assetSums[a.type] += a.homeBalance
      assetCounts[a.type] += 1
    }
  }
  for (const w of wallets) {
    for (const p of w.pockets) currencies.add(p.currency)
    assetSums.wallet += w.totalHomeBalance
    assetCounts.wallet += 1
  }

  const assetsTotal = assetSums.bank + assetSums.brokerage + assetSums.wallet
  const liabilitiesTotal = liabilitySums.loan

  const assetRows = ASSET_GROUP_ORDER.filter((t) => assetCounts[t] > 0).map(
    (t) => ({
      type: t,
      value: assetSums[t],
      pct: assetsTotal > 0 ? (assetSums[t] / assetsTotal) * 100 : 0,
    })
  )
  const liabilityRows = LIABILITY_GROUP_ORDER.filter(
    (t) => liabilityCounts[t] > 0
  ).map((t) => ({
    type: t,
    value: liabilitySums[t],
    pct: liabilitiesTotal > 0 ? (liabilitySums[t] / liabilitiesTotal) * 100 : 0,
  }))

  return {
    assets: { total: assetsTotal, rows: assetRows },
    liabilities: { total: liabilitiesTotal, rows: liabilityRows },
    net: assetsTotal - liabilitiesTotal,
    currencyCount: currencies.size,
    totalEntities: accounts.length + wallets.length,
  }
}
