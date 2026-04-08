import { useEffect, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { IconFilter } from "@tabler/icons-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import type {
  AccountData,
  CategoryData,
  TransactionData,
  TransactionFilters,
} from "@/components/transactions/transaction-types"
import { api } from "@/lib/api"
import { TransactionDeleteDialog } from "@/components/transactions/transaction-delete-dialog"
import { TransactionFab } from "@/components/transactions/transaction-fab"
import { TransactionFilterSheet } from "@/components/transactions/transaction-filters"
import { TransactionFormDialog } from "@/components/transactions/transaction-form-dialog"
import { TransactionList } from "@/components/transactions/transaction-list"
import { TransferFormDialog } from "@/components/transactions/transfer-form-dialog"

export const Route = createFileRoute("/_app/transactions")({
  component: TransactionsPage,
})

const PAGE_SIZE = 50

function TransactionsPage() {
  const [transactions, setTransactions] = useState<Array<TransactionData>>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [accounts, setAccounts] = useState<Array<AccountData>>([])
  const [categories, setCategories] = useState<Array<CategoryData>>([])
  const [filters, setFilters] = useState<TransactionFilters>({})
  const [unsettledCount, setUnsettledCount] = useState(0)

  const [formOpen, setFormOpen] = useState(false)
  const [formType, setFormType] = useState<"expense" | "income">("expense")
  const [transferFormOpen, setTransferFormOpen] = useState(false)
  const [editTransaction, setEditTransaction] =
    useState<TransactionData | null>(null)
  const [deleteTransaction, setDeleteTransaction] =
    useState<TransactionData | null>(null)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)
  const [orphanedCount, setOrphanedCount] = useState(0)

  function buildQuery(p: number, f: TransactionFilters) {
    const params = new URLSearchParams()
    params.set("page", String(p))
    params.set("limit", String(PAGE_SIZE))
    if (f.accountId) params.set("accountId", f.accountId)
    if (f.type) params.set("type", f.type)
    if (f.categoryId) params.set("categoryId", f.categoryId)
    if (f.settled !== undefined) params.set("settled", String(f.settled))
    if (f.dateFrom) params.set("dateFrom", new Date(f.dateFrom).toISOString())
    if (f.orphaned === true) params.set("orphaned", "true")
    if (f.dateTo) params.set("dateTo", new Date(f.dateTo).toISOString())
    return params.toString()
  }

  async function fetchTransactions(p: number, f: TransactionFilters) {
    const res = await api.get(`/transactions?${buildQuery(p, f)}`)
    return res.json()
  }

  async function fetchUnsettledCount() {
    const res = await api.get("/transactions?settled=false&limit=1")
    const data = await res.json()
    setUnsettledCount(data.total ?? 0)
  }

  async function fetchOrphanedCount() {
    const res = await api.get("/transactions?orphaned=true&limit=1")
    const data = await res.json()
    setOrphanedCount(data.total ?? 0)
  }

  async function refetch() {
    const data = await fetchTransactions(1, filters)
    setTransactions(data.data)
    setTotal(data.total)
    setPage(1)
    fetchUnsettledCount()
    fetchOrphanedCount()
  }

  useEffect(() => {
    Promise.all([
      fetchTransactions(1, filters),
      api.get("/accounts").then((r) => r.json()),
      api.get("/categories").then((r) => r.json()),
    ])
      .then(([txData, accs, cats]) => {
        setTransactions(txData.data ?? [])
        setTotal(txData.total ?? 0)
        setAccounts(Array.isArray(accs) ? accs : [])
        setCategories(Array.isArray(cats) ? cats : [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))

    fetchUnsettledCount()
    fetchOrphanedCount()
  }, [])

  const [initialLoad, setInitialLoad] = useState(true)

  useEffect(() => {
    if (initialLoad) {
      setInitialLoad(false)
      return
    }
    setLoading(true)
    fetchTransactions(1, filters)
      .then((data) => {
        setTransactions(data.data ?? [])
        setTotal(data.total ?? 0)
        setPage(1)
      })
      .finally(() => setLoading(false))
  }, [filters])

  async function handleLoadMore() {
    setLoadingMore(true)
    try {
      const nextPage = page + 1
      const data = await fetchTransactions(nextPage, filters)
      setTransactions((prev) => [...prev, ...data.data])
      setPage(nextPage)
    } finally {
      setLoadingMore(false)
    }
  }

  function handleClickTransaction(t: TransactionData) {
    setEditTransaction(t)
    if (t.transferId) {
      setTransferFormOpen(true)
    } else {
      setFormOpen(true)
    }
  }

  function handleExpense() {
    setEditTransaction(null)
    setFormType("expense")
    setFormOpen(true)
  }
  function handleIncome() {
    setEditTransaction(null)
    setFormType("income")
    setFormOpen(true)
  }
  function handleTransfer() {
    setEditTransaction(null)
    setTransferFormOpen(true)
  }

  async function handleTransactionSubmit(data: {
    accountId: string
    type: string
    amount: number
    categoryId: string
    date: string
    note?: string
    myShare?: number
    originalAmount?: number
    originalCurrency?: string
    exchangeRate?: number
  }) {
    let res: Response
    if (editTransaction) {
      const { type: _, ...updateFields } = data
      // Only send accountId if reassigning an orphaned transaction
      if (editTransaction.accountId !== null) {
        delete (updateFields as Record<string, unknown>).accountId
      }
      res = await api.patch(`/transactions/${editTransaction.id}`, updateFields)
    } else {
      res = await api.post("/transactions", data)
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body?.message ?? "Request failed")
    }
    await refetch()
  }

  async function handleTransferSubmit(data: {
    fromAccountId: string
    toAccountId: string
    amount: number
    date: string
    note?: string
    originalAmount?: number
    originalCurrency?: string
    exchangeRate?: number
  }) {
    let res: Response
    if (editTransaction?.transferId) {
      res = await api.patch(
        `/transactions/transfers/${editTransaction.transferId}`,
        data
      )
    } else {
      res = await api.post("/transactions/transfers", data)
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body?.message ?? "Request failed")
    }
    await refetch()
  }

  async function handleDelete() {
    if (!deleteTransaction) return
    if (deleteTransaction.transferId) {
      await api.del(
        `/transactions/transfers/${deleteTransaction.transferId}`
      )
    } else {
      await api.del(`/transactions/${deleteTransaction.id}`)
    }
    await refetch()
  }

  async function handleSettle() {
    if (!editTransaction) return
    const res = await api.patch(`/transactions/${editTransaction.id}/settle`)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body?.message ?? "Request failed")
    }
    setFormOpen(false)
    setEditTransaction(null)
    await refetch()
  }

  function handleToggleUnsettled() {
    if (filters.settled === false) {
      setFilters((prev) => {
        const { settled: _, ...rest } = prev
        return rest
      })
    } else {
      setFilters((prev) => ({ ...prev, settled: false }))
    }
  }

  function handleToggleOrphaned() {
    if (filters.orphaned === true) {
      setFilters((prev) => {
        const { orphaned: _, ...rest } = prev
        return rest
      })
    } else {
      setFilters((prev) => ({ ...prev, orphaned: true }))
    }
  }

  const activeFilterBadges: Array<{ key: string; label: string }> = []
  if (filters.accountId) {
    const acc = accounts.find((a) => a.id === filters.accountId)
    activeFilterBadges.push({
      key: "accountId",
      label: acc?.name ?? "Account",
    })
  }
  if (filters.type) {
    activeFilterBadges.push({
      key: "type",
      label: filters.type.charAt(0).toUpperCase() + filters.type.slice(1),
    })
  }
  if (filters.categoryId) {
    const cat = categories.find((c) => c.id === filters.categoryId)
    activeFilterBadges.push({
      key: "categoryId",
      label: cat?.name ?? "Category",
    })
  }
  if (filters.dateFrom || filters.dateTo) {
    activeFilterBadges.push({
      key: "date",
      label: [filters.dateFrom, filters.dateTo].filter(Boolean).join(" – "),
    })
  }
  if (filters.orphaned) {
    activeFilterBadges.push({ key: "orphaned", label: "Orphaned" })
  }

  function removeFilter(key: string) {
    setFilters((prev) => {
      const next = { ...prev }
      if (key === "date") {
        delete next.dateFrom
        delete next.dateTo
      } else {
        delete next[key as keyof TransactionFilters]
      }
      return next
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl font-semibold">Transactions</h1>
        <div className="flex items-center gap-2">
          {unsettledCount > 0 && (
            <button
              type="button"
              onClick={handleToggleUnsettled}
              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                filters.settled === false
                  ? "border-amber-400 bg-amber-400/20 text-amber-400"
                  : "border-amber-400/50 text-amber-400 hover:bg-amber-400/10"
              }`}
            >
              ⚠ Unsettled ({unsettledCount})
            </button>
          )}
          {orphanedCount > 0 && (
            <button
              type="button"
              onClick={handleToggleOrphaned}
              className={`rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors ${
                filters.orphaned === true
                  ? "border-orange-400 bg-orange-400/20 text-orange-400"
                  : "border-orange-400/50 text-orange-400 hover:bg-orange-400/10"
              }`}
            >
              ⚠ Orphaned ({orphanedCount})
            </button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilterSheetOpen(true)}
          >
            <IconFilter className="size-4" />
            Filters
          </Button>
        </div>
      </div>

      {activeFilterBadges.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {activeFilterBadges.map((badge) => (
            <Badge
              key={badge.key}
              variant="secondary"
              className="cursor-pointer gap-1"
              onClick={() => removeFilter(badge.key)}
            >
              {badge.label}
              <span className="text-muted-foreground">✕</span>
            </Badge>
          ))}
        </div>
      )}

      <TransactionList
        transactions={transactions}
        accounts={accounts}
        categories={categories}
        loading={loading}
        hasMore={transactions.length < total}
        onLoadMore={handleLoadMore}
        loadingMore={loadingMore}
        onClickTransaction={handleClickTransaction}
      />

      <TransactionFab
        onExpense={handleExpense}
        onIncome={handleIncome}
        onTransfer={handleTransfer}
      />

      <TransactionFormDialog
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o)
          if (!o) setEditTransaction(null)
        }}
        transaction={editTransaction}
        defaultType={formType}
        accounts={accounts}
        categories={categories}
        onSubmit={handleTransactionSubmit}
        onDelete={
          editTransaction
            ? () => {
                setFormOpen(false)
                setDeleteTransaction(editTransaction)
              }
            : undefined
        }
        onSettle={handleSettle}
      />

      <TransferFormDialog
        open={transferFormOpen}
        onOpenChange={(o) => {
          setTransferFormOpen(o)
          if (!o) setEditTransaction(null)
        }}
        transaction={editTransaction}
        pairedAccountId={
          editTransaction?.transferId
            ? (transactions.find(
                (t) =>
                  t.transferId === editTransaction.transferId &&
                  t.id !== editTransaction.id
              )?.accountId ?? null)
            : null
        }
        accounts={accounts}
        onSubmit={handleTransferSubmit}
        onDelete={
          editTransaction
            ? () => {
                setTransferFormOpen(false)
                setDeleteTransaction(editTransaction)
              }
            : undefined
        }
      />

      <TransactionDeleteDialog
        open={!!deleteTransaction}
        onOpenChange={(o) => {
          if (!o) setDeleteTransaction(null)
        }}
        isTransfer={!!deleteTransaction?.transferId}
        onConfirm={handleDelete}
      />

      <TransactionFilterSheet
        open={filterSheetOpen}
        onOpenChange={setFilterSheetOpen}
        filters={filters}
        onApply={setFilters}
        accounts={accounts}
        categories={categories}
      />
    </div>
  )
}
