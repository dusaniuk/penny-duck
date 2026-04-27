import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { IconFilter, IconPlus } from "@tabler/icons-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import type {
  Account,
  Category,
  Member,
  Transaction,
} from "@workspace/api-contract"
import { queryClient, tsr } from "@/lib/api"
import { TransactionDeleteDialog } from "@/components/transactions/transaction-delete-dialog"
import { TransactionFab } from "@/components/transactions/transaction-fab"
import { TransactionFilterSheet } from "@/components/transactions/transaction-filters"
import { TransactionFormDialog } from "@/components/transactions/transaction-form-dialog"
import { TransactionList } from "@/components/transactions/transaction-list"
import { ReimbursementDialog } from "@/components/transactions/reimbursement-dialog"
import { useTransactionCreate } from "@/components/transactions/use-transaction-create"

interface TransactionFilters {
  accountId?: string
  type?: string
  categoryId?: string
  settled?: boolean
  uncategorized?: boolean
  dateFrom?: string
  dateTo?: string
  madeById?: string
}

export const Route = createFileRoute("/_app/transactions")({
  staticData: { breadcrumb: "Transactions" },
  component: TransactionsPage,
})

const PAGE_SIZE = 50

function TransactionsPage() {
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState<TransactionFilters>({})

  const [formOpen, setFormOpen] = useState(false)
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(
    null
  )
  const [deleteTransaction, setDeleteTransaction] =
    useState<Transaction | null>(null)
  const [reimburseTransaction, setReimburseTransaction] =
    useState<Transaction | null>(null)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)

  const { openCreate, dialog: createDialog } = useTransactionCreate({
    onSuccess: () => {
      setExtraTransactions([])
      setPage(1)
    },
  })

  const { data: txData, isLoading: loading } = tsr.transactions.list.useQuery({
    queryKey: ["transactions", filters, page],
    queryData: {
      query: {
        page,
        limit: PAGE_SIZE,
        accountId: filters.accountId,
        type: filters.type as "expense" | "income" | undefined,
        categoryId: filters.categoryId,
        settled: filters.settled,
        uncategorized: filters.uncategorized,
        dateFrom: filters.dateFrom
          ? new Date(filters.dateFrom).toISOString()
          : undefined,
        dateTo: filters.dateTo
          ? new Date(filters.dateTo).toISOString()
          : undefined,
        madeById: filters.madeById,
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

  const { data: uncategorizedData } = tsr.transactions.list.useQuery({
    queryKey: ["transactions", "uncategorized-count"],
    queryData: { query: { uncategorized: true, limit: 1 } },
  })
  const uncategorizedCount = uncategorizedData?.body.total ?? 0

  const { data: accountsData } = tsr.accounts.list.useQuery({
    queryKey: ["accounts"],
  })
  const accounts: Array<Account> = accountsData?.body ?? []

  const { data: categoriesData } = tsr.categories.list.useQuery({
    queryKey: ["categories"],
  })
  const categories: Array<Category> = categoriesData?.body ?? []

  const { data: meData } = tsr.users.getMe.useQuery({
    queryKey: ["users", "me"],
  })
  const homeCurrency = meData?.body.homeCurrency ?? "UAH"
  const currentUserId = meData?.body.id ?? ""

  const { data: membersData } = tsr.users.getMembers.useQuery({
    queryKey: ["users", "members"],
  })
  const members: Array<Member> = membersData?.body ?? []

  const { data: ratesData } = tsr.exchangeRates.latest.useQuery({
    queryKey: ["exchange-rates", "latest"],
  })
  const latestRates = ratesData?.body.rates ?? {}

  const [loadingMore, setLoadingMore] = useState(false)
  const [extraTransactions, setExtraTransactions] = useState<
    Array<Transaction>
  >([])

  const allTransactions =
    page === 1 ? transactions : [...transactions, ...extraTransactions]

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["transactions"] })
    queryClient.invalidateQueries({ queryKey: ["accounts"] })
  }

  const updateMutation = tsr.transactions.update.useMutation({
    onSuccess: invalidateAll,
  })
  const deleteMutation = tsr.transactions.delete.useMutation({
    onSuccess: invalidateAll,
  })
  const settleMutation = tsr.transactions.settle.useMutation({
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
          madeById: filters.madeById,
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
    setFormOpen(true)
  }

  async function handleTransactionSubmit(data: {
    accountId: string
    type: string
    amount: number
    categoryId: string
    date: string
    note?: string
    settled?: boolean
    madeById?: string
  }) {
    if (!editTransaction) return
    const { type: _, ...updateFields } = data
    await updateMutation.mutateAsync({
      params: { id: editTransaction.id },
      body: updateFields,
    })
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
    madeById?: string
  }) {
    if (!editTransaction?.transferId) return
    const { fromAccountId: _, toAccountId: __, ...updateData } = data
    await updateTransferMutation.mutateAsync({
      params: { transferId: editTransaction.transferId },
      body: updateData,
    })
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

  function handleToggleUncategorized() {
    if (filters.uncategorized === true) {
      setFilters((prev) => {
        const { uncategorized: _, ...rest } = prev
        return rest
      })
    } else {
      setFilters((prev) => ({ ...prev, uncategorized: true }))
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
  if (filters.madeById) {
    const member = members.find((m) => m.id === filters.madeById)
    activeFilterBadges.push({
      key: "madeById",
      label: member?.name ?? "Member",
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
        <h1 className="font-heading text-2xl font-semibold">Transactions</h1>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={openCreate}>
            <IconPlus className="size-4" />
            New
          </Button>
          {unsettledCount > 0 && (
            <button
              type="button"
              onClick={handleToggleUnsettled}
              className={`rounded-full border px-2.5 py-0.5 text-sm font-medium transition-colors ${
                filters.settled === false
                  ? "border-amber-400 bg-amber-400/20 text-amber-400"
                  : "border-amber-400/50 text-amber-400 hover:bg-amber-400/10"
              }`}
            >
              ⚠ Unsettled ({unsettledCount})
            </button>
          )}
          {uncategorizedCount > 0 && (
            <button
              type="button"
              onClick={handleToggleUncategorized}
              className={`rounded-full border px-2.5 py-0.5 text-sm font-medium transition-colors ${
                filters.uncategorized === true
                  ? "border-rose-400 bg-rose-400/20 text-rose-400"
                  : "border-rose-400/50 text-rose-400 hover:bg-rose-400/10"
              }`}
            >
              ⚠ Uncategorized ({uncategorizedCount})
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
        showMember={members.length > 1}
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

      <TransactionFab onOpen={openCreate} />
      {createDialog}

      <TransactionFormDialog
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o)
          if (!o) setEditTransaction(null)
        }}
        transaction={editTransaction}
        accounts={accounts}
        categories={categories}
        members={members}
        currentUserId={currentUserId}
        exchangeRates={latestRates}
        pairedAccountId={
          editTransaction?.transferId
            ? (allTransactions.find(
                (t) =>
                  t.transferId === editTransaction.transferId &&
                  t.id !== editTransaction.id
              )?.accountId ?? null)
            : null
        }
        onSubmitTransaction={handleTransactionSubmit}
        onSubmitTransfer={handleTransferSubmit}
        onDelete={
          editTransaction
            ? () => {
                setFormOpen(false)
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
        members={members}
        currentUserId={currentUserId}
        onSubmit={async (data) => {
          await createReimbursementMutation.mutateAsync({
            params: { id: data.transactionId },
            body: {
              accountId: data.accountId,
              amount: data.amount,
              date: data.date,
              exchangeRate: data.exchangeRate,
              madeById: data.madeById,
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
        members={members}
      />
    </div>
  )
}
