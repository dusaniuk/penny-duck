import { TransactionRow } from "./transaction-row"
import type { Account, Category, Transaction } from "@workspace/api-contract"

interface TransactionListProps {
  transactions: Array<Transaction>
  accounts: Array<Account>
  categories: Array<Category>
  homeCurrency: string
  showMember: boolean
  loading: boolean
  hasMore: boolean
  onLoadMore: () => void
  loadingMore: boolean
  onEdit: (transaction: Transaction) => void
  onReimburse: (transaction: Transaction) => void
  onSettle: (transaction: Transaction) => void
  onDelete: (transaction: Transaction) => void
}

interface DateGroup {
  label: string
  subtotal: number
  transactions: Array<Transaction>
}

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.round(
    (today.getTime() - target.getTime()) / (1000 * 60 * 60 * 24)
  )

  const formatted = date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })

  if (diffDays === 0) return `Today · ${formatted}`
  if (diffDays === 1) return `Yesterday · ${formatted}`
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function deduplicateTransfers(
  transactions: Array<Transaction>
): Array<Transaction> {
  // First pass: pick the preferred side per transferId (outgoing = has exchangeRate)
  const preferred = new Map<string, Transaction>()
  for (const t of transactions) {
    if (!t.transferId) continue
    const existing = preferred.get(t.transferId)
    if (
      !existing ||
      (t.exchangeRate != null && existing.exchangeRate == null)
    ) {
      preferred.set(t.transferId, t)
    }
  }

  // Second pass: filter, keeping order, replacing with preferred side
  const seen = new Set<string>()
  return transactions
    .filter((t) => {
      if (!t.transferId) return true
      if (seen.has(t.transferId)) return false
      seen.add(t.transferId)
      return true
    })
    .map((t) => {
      if (t.transferId && preferred.has(t.transferId)) {
        return preferred.get(t.transferId)!
      }
      return t
    })
}

function groupByDate(transactions: Array<Transaction>): Array<DateGroup> {
  const deduplicated = deduplicateTransfers(transactions)
  const groups = new Map<string, Array<Transaction>>()

  for (const t of deduplicated) {
    const dateKey = new Date(t.date).toLocaleDateString("en-CA")
    const existing = groups.get(dateKey) ?? []
    existing.push(t)
    groups.set(dateKey, existing)
  }

  return Array.from(groups.entries()).map(([, txs]) => {
    const subtotal = txs.reduce((sum, t) => {
      if (t.transferId) return sum
      if (t.type === "expense") return sum - t.homeAmount
      return sum + t.homeAmount
    }, 0)

    return {
      label: formatDateLabel(txs[0].date),
      subtotal,
      transactions: txs,
    }
  })
}

export function TransactionList({
  transactions,
  accounts,
  categories,
  homeCurrency,
  showMember,
  loading,
  hasMore,
  onLoadMore,
  loadingMore,
  onEdit,
  onReimburse,
  onSettle,
  onDelete,
}: TransactionListProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-[52px] animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    )
  }

  if (transactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <p className="text-base">No transactions yet</p>
        <p className="mt-1 text-sm">
          Use the + button to create your first transaction
        </p>
      </div>
    )
  }

  const groups = groupByDate(transactions)

  // Build a map of transferId → paired account name (the other side)
  const transferPairAccount = new Map<string, string>()
  const transfersByTransferId = new Map<string, Array<Transaction>>()
  for (const t of transactions) {
    if (!t.transferId) continue
    const arr = transfersByTransferId.get(t.transferId) ?? []
    arr.push(t)
    transfersByTransferId.set(t.transferId, arr)
  }
  for (const [transferId, pair] of transfersByTransferId) {
    if (pair.length === 2) {
      const kept = groups
        .flatMap((g) => g.transactions)
        .find((t) => t.transferId === transferId)
      if (kept) {
        const other = pair.find((t) => t.id !== kept.id)
        const otherAcc = accounts.find((a) => a.id === other?.accountId)
        if (otherAcc) transferPairAccount.set(transferId, otherAcc.name)
      }
    }
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.label}>
          <div className="flex items-center justify-between px-0 py-1.5 sm:px-3">
            <span className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
              {group.label}
            </span>
            <span
              className={`text-sm tabular-nums ${
                group.subtotal < 0
                  ? "text-red-400"
                  : group.subtotal > 0
                    ? "text-green-400"
                    : "text-muted-foreground"
              }`}
            >
              {group.subtotal >= 0 ? "+" : ""}
              {group.subtotal.toFixed(2)} {homeCurrency}
            </span>
          </div>
          <div className="space-y-0.5">
            {group.transactions.map((t) => (
              <TransactionRow
                key={t.id}
                transaction={t}
                accounts={accounts}
                categories={categories}
                pairedAccountName={
                  t.transferId
                    ? (transferPairAccount.get(t.transferId) ?? null)
                    : null
                }
                showMember={showMember}
                onEdit={onEdit}
                onReimburse={onReimburse}
                onSettle={onSettle}
                onDelete={onDelete}
              />
            ))}
          </div>
        </div>
      ))}

      {hasMore && (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            onClick={onLoadMore}
            disabled={loadingMore}
            className="rounded-md px-4 py-2 text-base text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            {loadingMore ? "Loading…" : "Load more"}
          </button>
        </div>
      )}
    </div>
  )
}
