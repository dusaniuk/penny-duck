import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { IconFilter } from "@tabler/icons-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import type { Account, Category, Transaction } from "@workspace/api-contract"
import { queryClient, tsr } from "@/lib/api"
import { TransactionDeleteDialog } from "@/components/transactions/transaction-delete-dialog"
import { TransactionFab } from "@/components/transactions/transaction-fab"
import { TransactionFilterSheet } from "@/components/transactions/transaction-filters"
import { TransactionFormDialog } from "@/components/transactions/transaction-form-dialog"
import { TransactionList } from "@/components/transactions/transaction-list"
import { ReimbursementDialog } from "@/components/transactions/reimbursement-dialog"
import { TransferFormDialog } from "@/components/transactions/transfer-form-dialog"

interface TransactionFilters {
  accountId?: string
  type?: string
  categoryId?: string
  settled?: boolean
  dateFrom?: string
  dateTo?: string
}

export const Route = createFileRoute("/_app/transactions")({
  component: TransactionsPage,
})

const PAGE_SIZE = 50

function TransactionsPage() {
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<TransactionFilters>({})

  const [formOpen, setFormOpen] = useState(false)
  const [formType, setFormType] = useState<"expense" | "income">("expense")
  const [transferFormOpen, setTransferFormOpen] = useState(false)
  const [editTransaction, setEditTransaction] =
    useState<Transaction | null>(null)
  const [deleteTransaction, setDeleteTransaction] =
    useState<Transaction | null>(null)
  const [reimburseTransaction, setReimburseTransaction] =
    useState<Transaction | null>(null)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)

  const { data: txData, isLoading: loading } =
    tsr.transactions.list.useQuery({
      queryKey: ["transactions", filters, page],
      queryData: {
        query: {
          page,
          limit: PAGE_SIZE,
          accountId: filters.accountId,
          type: filters.type as "expense" | "income" | undefined,
          categoryId: filters.categoryId,
          settled: filters.settled,
          dateFrom: filters.dateFrom
            ? new Date(filters.dateFrom).toISOString()
            : undefined,
          dateTo: filters.dateTo
            ? new Date(filters.dateTo).toISOString()
            : undefined,
        },
      },
    })

  const transactions = txData?.body.data ?? []
  const total = txData?.body.total ?? 0

  const { data: unsettledData } = tsr.transactions.list.useQuery({
    queryKey: ["transactions", "unsettled-count"],
    queryData: { query: { settled: false, limit: 1 } },
  })
  const unsettledCount = unsettledData?.body.total ?? 0

  const { data: accountsData } = tsr.accounts.list.useQuery({
    queryKey: ["accounts"],
  })
  const accounts: Array<Account> = accountsData?.body ?? []

  const { data: categoriesData } = tsr.categories.list.useQuery({
    queryKey: ["categories"],
  })
  const categories: Array<Category> = categoriesData?.body ?? []

  const { data: meData } = tsr.auth.me.useQuery({ queryKey: ["auth", "me"] })
  const homeCurrency = meData?.body.homeCurrency ?? "UAH"

  const { data: ratesData } = tsr.exchangeRates.latest.useQuery({
    queryKey: ["exchange-rates", "latest"],
  })
  const latestRates = ratesData?.body.rates ?? {}

  const [loadingMore, setLoadingMore] = useState(false)
  const [extraTransactions, setExtraTransactions] = useState<Array<Transaction>>([])

  const allTransactions =
    page === 1 ? transactions : [...transactions, ...extraTransactions]

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["transactions"] })
    queryClient.invalidateQueries({ queryKey: ["accounts"] })
  }

  const createMutation = tsr.transactions.create.useMutation({
    onSuccess: invalidateAll,
  })
  const updateMutation = tsr.transactions.update.useMutation({
    onSuccess: invalidateAll,
  })
  const deleteMutation = tsr.transactions.delete.useMutation({
    onSuccess: invalidateAll,
  })
  const settleMutation = tsr.transactions.settle.useMutation({
    onSuccess: invalidateAll,
  })
  const createTransferMutation = tsr.transactions.createTransfer.useMutation({
    onSuccess: invalidateAll,
  })
  const updateTransferMutation = tsr.transactions.updateTransfer.useMutation({
    onSuccess: invalidateAll,
  })
  const deleteTransferMutation = tsr.transactions.deleteTransfer.useMutation({
    onSuccess: invalidateAll,
  })
  const createReimbursementMutation =
    tsr.transactions.createReimbursement.useMutation({
      onSuccess: invalidateAll,
    })

  async function handleLoadMore() {
    setLoadingMore(true)
    try {
      const nextPage = page + 1
      const result = await tsr.transactions.list.query({
        query: {
          page: nextPage,
          limit: PAGE_SIZE,
          accountId: filters.accountId,
          type: filters.type as "expense" | "income" | undefined,
          categoryId: filters.categoryId,
          settled: filters.settled,
          dateFrom: filters.dateFrom
            ? new Date(filters.dateFrom).toISOString()
            : undefined,
          dateTo: filters.dateTo
            ? new Date(filters.dateTo).toISOString()
            : undefined,
        },
      })
      setExtraTransactions((prev) => [
        ...prev,
        ...(result.body as { data: Array<Transaction> }).data,
      ])
      setPage(nextPage)
    } finally {
      setLoadingMore(false)
    }
  }

  function handleClickTransaction(t: Transaction) {
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
    settled?: boolean
    originalAmount?: number
    originalCurrency?: string
    exchangeRate?: number
  }) {
    if (editTransaction) {
      const { type: _, ...updateFields } = data
      await updateMutation.mutateAsync({
        params: { id: editTransaction.id },
        body: updateFields,
      })
    } else {
      await createMutation.mutateAsync({
        body: {
          ...data,
          type: data.type as "expense" | "income",
        },
      })
    }
    setExtraTransactions([])
    setPage(1)
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
    if (editTransaction?.transferId) {
      const { fromAccountId: _, toAccountId: __, ...updateData } = data
      await updateTransferMutation.mutateAsync({
        params: { transferId: editTransaction.transferId },
        body: updateData,
      })
    } else {
      await createTransferMutation.mutateAsync({ body: data })
    }
    setExtraTransactions([])
    setPage(1)
  }

  async function handleDelete() {
    if (!deleteTransaction) return
    if (deleteTransaction.transferId) {
      await deleteTransferMutation.mutateAsync({
        params: { transferId: deleteTransaction.transferId },
      })
    } else {
      await deleteMutation.mutateAsync({
        params: { id: deleteTransaction.id },
      })
    }
    setExtraTransactions([])
    setPage(1)
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
    setExtraTransactions([])
    setPage(1)
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
    setExtraTransactions([])
    setPage(1)
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
        transactions={allTransactions}
        accounts={accounts}
        categories={categories}
        homeCurrency={homeCurrency}
        loading={loading}
        hasMore={allTransactions.length < total}
        onLoadMore={handleLoadMore}
        loadingMore={loadingMore}
        onEdit={handleClickTransaction}
        onReimburse={(t) => setReimburseTransaction(t)}
        onSettle={(t) => {
          settleMutation.mutate({ params: { id: t.id } })
        }}
        onDelete={(t) => setDeleteTransaction(t)}
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
            ? (allTransactions.find(
                (t) =>
                  t.transferId === editTransaction.transferId &&
                  t.id !== editTransaction.id
              )?.accountId ?? null)
            : null
        }
        accounts={accounts}
        exchangeRates={latestRates}
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

      <ReimbursementDialog
        open={!!reimburseTransaction}
        onOpenChange={(o) => {
          if (!o) setReimburseTransaction(null)
        }}
        transaction={reimburseTransaction}
        accounts={accounts}
        exchangeRates={latestRates}
        onSubmit={async (data) => {
          await createReimbursementMutation.mutateAsync({
            params: { id: data.transactionId },
            body: {
              accountId: data.accountId,
              amount: data.amount,
              date: data.date,
              exchangeRate: data.exchangeRate,
            },
          })
        }}
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
        onApply={(f) => {
          setFilters(f)
          setExtraTransactions([])
          setPage(1)
        }}
        accounts={accounts}
        categories={categories}
      />
    </div>
  )
}
