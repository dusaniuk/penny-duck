import { useMemo, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { IconFilter, IconPlus } from "@tabler/icons-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { useMutation, useQuery } from "@tanstack/react-query"
import type {
  Category,
  Member,
  Transaction,
} from "@workspace/api-contract"
import { api, queryClient } from "@/lib/api"
import { flattenAccounts, walletsOf } from "@/lib/accounts"
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

  const { data: txData, isLoading: loading } = useQuery({
    queryKey: ["transactions", filters, page],
    queryFn: async () => {
      const res = await api.transactions.$get({
        query: {
          page: String(page),
          limit: String(PAGE_SIZE),
          accountId: filters.accountId,
          type: filters.type as "expense" | "income" | undefined,
          categoryId: filters.categoryId,
          settled:
            filters.settled !== undefined ? String(filters.settled) : undefined,
          uncategorized:
            filters.uncategorized !== undefined
              ? String(filters.uncategorized)
              : undefined,
          dateFrom: filters.dateFrom
            ? new Date(filters.dateFrom).toISOString()
            : undefined,
          dateTo: filters.dateTo
            ? new Date(filters.dateTo).toISOString()
            : undefined,
          madeById: filters.madeById,
        },
      })
      if (!res.ok) throw await res.json()
      return res.json()
    },
  })

  const transactions = txData?.data ?? []
  const total = txData?.total ?? 0

  const { data: unsettledData } = useQuery({
    queryKey: ["transactions", "unsettled-count"],
    queryFn: async () => {
      const res = await api.transactions.$get({
        query: { settled: "false", limit: "1" },
      })
      if (!res.ok) throw await res.json()
      return res.json()
    },
  })
  const unsettledCount = unsettledData?.total ?? 0

  const { data: uncategorizedData } = useQuery({
    queryKey: ["transactions", "uncategorized-count"],
    queryFn: async () => {
      const res = await api.transactions.$get({
        query: { uncategorized: "true", limit: "1" },
      })
      if (!res.ok) throw await res.json()
      return res.json()
    },
  })
  const uncategorizedCount = uncategorizedData?.total ?? 0

  const { data: accountsData } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const res = await api.accounts.$get()
      if (!res.ok) throw await res.json()
      return res.json()
    },
  })
  const accounts = useMemo(() => flattenAccounts(accountsData), [accountsData])
  const wallets = walletsOf(accountsData)

  const { data: categoriesData } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await api.categories.$get()
      if (!res.ok) throw await res.json()
      return res.json()
    },
  })
  const categories: Array<Category> = categoriesData ?? []

  const { data: meData } = useQuery({
    queryKey: ["users", "me"],
    queryFn: async () => {
      const res = await api.users.me.$get()
      if (!res.ok) throw await res.json()
      return res.json()
    },
  })
  const homeCurrency = meData?.homeCurrency ?? "UAH"
  const currentUserId = meData?.id ?? ""

  const { data: membersData } = useQuery({
    queryKey: ["users", "members"],
    queryFn: async () => {
      const res = await api.users.members.$get()
      if (!res.ok) throw await res.json()
      return res.json()
    },
  })
  const members: Array<Member> = membersData ?? []

  const { data: ratesData } = useQuery({
    queryKey: ["exchange-rates", "latest"],
    queryFn: async () => {
      const res = await api["exchange-rates"].latest.$get()
      if (!res.ok) throw await res.json()
      return res.json()
    },
  })
  const latestRates = ratesData?.rates ?? {}

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

  const updateMutation = useMutation({
    mutationFn: async (vars: {
      id: string
      body: {
        accountId?: string
        amount?: number
        categoryId?: string
        note?: string
        date?: string
        originalAmount?: number
        originalCurrency?: string
        exchangeRate?: number
        madeById?: string
        settled?: boolean
      }
    }) => {
      const res = await api.transactions[":id"].$patch({
        param: { id: vars.id },
        json: vars.body,
      })
      if (!res.ok) throw await res.json()
      return res.json()
    },
    onSuccess: invalidateAll,
  })
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.transactions[":id"].$delete({ param: { id } })
      if (!res.ok) throw await res.json()
      return res.json()
    },
    onSuccess: invalidateAll,
  })
  const settleMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.transactions[":id"].settle.$patch({
        param: { id },
      })
      if (!res.ok) throw await res.json()
      return res.json()
    },
    onSuccess: invalidateAll,
  })
  const updateTransferMutation = useMutation({
    mutationFn: async (vars: {
      transferId: string
      body: {
        amount?: number
        date?: string
        note?: string
        originalAmount?: number
        originalCurrency?: string
        exchangeRate?: number
        madeById?: string
      }
    }) => {
      const res = await api.transactions.transfers[":transferId"].$patch({
        param: { transferId: vars.transferId },
        json: vars.body,
      })
      if (!res.ok) throw await res.json()
      return res.json()
    },
    onSuccess: invalidateAll,
  })
  const deleteTransferMutation = useMutation({
    mutationFn: async (transferId: string) => {
      const res = await api.transactions.transfers[":transferId"].$delete({
        param: { transferId },
      })
      if (!res.ok) throw await res.json()
      return res.json()
    },
    onSuccess: invalidateAll,
  })
  const createReimbursementMutation = useMutation({
    mutationFn: async (vars: {
      id: string
      body: {
        accountId: string
        amount: number
        date: string
        exchangeRate?: number
        madeById?: string
      }
    }) => {
      const res = await api.transactions[":id"].reimburse.$post({
        param: { id: vars.id },
        json: vars.body,
      })
      if (!res.ok) throw await res.json()
      return res.json()
    },
    onSuccess: invalidateAll,
  })

  async function handleLoadMore() {
    setLoadingMore(true)
    try {
      const nextPage = page + 1
      const res = await api.transactions.$get({
        query: {
          page: String(nextPage),
          limit: String(PAGE_SIZE),
          accountId: filters.accountId,
          type: filters.type as "expense" | "income" | undefined,
          categoryId: filters.categoryId,
          settled:
            filters.settled !== undefined ? String(filters.settled) : undefined,
          dateFrom: filters.dateFrom
            ? new Date(filters.dateFrom).toISOString()
            : undefined,
          dateTo: filters.dateTo
            ? new Date(filters.dateTo).toISOString()
            : undefined,
          madeById: filters.madeById,
        },
      })
      if (!res.ok) throw await res.json()
      const body = await res.json()
      setExtraTransactions((prev) => [...prev, ...body.data])
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
      id: editTransaction.id,
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
      transferId: editTransaction.transferId,
      body: updateData,
    })
    setExtraTransactions([])
    setPage(1)
  }

  async function handleDelete() {
    if (!deleteTransaction) return
    if (deleteTransaction.transferId) {
      await deleteTransferMutation.mutateAsync(deleteTransaction.transferId)
    } else {
      await deleteMutation.mutateAsync(deleteTransaction.id)
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
          settleMutation.mutate(t.id)
        }}
        onDelete={(t) => setDeleteTransaction(t)}
      />

      <TransactionFab onOpen={openCreate} />
      {createDialog}

      <TransactionFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        transaction={editTransaction}
        accounts={accounts}
        wallets={wallets}
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
            id: data.transactionId,
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
