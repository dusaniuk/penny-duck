import { useMemo, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { IconX } from "@tabler/icons-react"
import { Badge } from "@workspace/ui/components/badge"
import { useMutation, useQuery } from "@tanstack/react-query"
import type { Category, Member, Transaction } from "@workspace/api-contract"
import { api, queryClient } from "@/lib/api"
import { flattenAccounts, walletsOf } from "@/lib/accounts"
import { MonthNavigator } from "@/components/spendings/month-navigator"
import { SpendingsDonutChart } from "@/components/spendings/spendings-donut-chart"
import { aggregateByCategory } from "@/components/spendings/aggregate-by-category"
import { useMonthTransactions } from "@/components/spendings/use-month-transactions"
import { TransactionList } from "@/components/transactions/transaction-list"
import { TransactionFormDialog } from "@/components/transactions/transaction-form-dialog"
import { TransactionDeleteDialog } from "@/components/transactions/transaction-delete-dialog"
import { ReimbursementDialog } from "@/components/transactions/reimbursement-dialog"

export const Route = createFileRoute("/_app/spendings")({
  staticData: { breadcrumb: "Spendings" },
  component: SpendingsPage,
})

function SpendingsPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null)

  const [formOpen, setFormOpen] = useState(false)
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(
    null
  )
  const [deleteTransaction, setDeleteTransaction] =
    useState<Transaction | null>(null)
  const [reimburseTransaction, setReimburseTransaction] =
    useState<Transaction | null>(null)

  const { data: transactions, isLoading } = useMonthTransactions(year, month)
  const { data: categoriesData } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await api.categories.$get()
      if (!res.ok) throw await res.json()
      return res.json()
    },
  })
  const categories: Array<Category> = categoriesData ?? []

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

  const chartData = transactions
    ? aggregateByCategory(transactions, categories)
    : []

  // Filter transactions for the list
  const expenseTransactions = (transactions ?? []).filter(
    (t) => t.type === "expense" && !t.transferId && !t.reimbursementId
  )

  // Category IDs shown as their own slice (not grouped into "Other")
  const mainCategoryIds = new Set(
    chartData.filter((d) => d.categoryId !== "other").map((d) => d.categoryId)
  )

  const filteredTransactions = activeCategoryId
    ? expenseTransactions.filter((t) => {
        if (activeCategoryId === "other") {
          // Show transactions from all small categories grouped into "Other"
          return !mainCategoryIds.has(t.categoryId ?? "uncategorized")
        }
        if (activeCategoryId === "uncategorized") return t.categoryId === null
        return t.categoryId === activeCategoryId
      })
    : expenseTransactions

  const activeCategoryName = chartData.find(
    (d) => d.categoryId === activeCategoryId
  )?.categoryName

  function handleMonthChange(newYear: number, newMonth: number) {
    setYear(newYear)
    setMonth(newMonth)
    setActiveCategoryId(null)
  }

  function handleSliceClick(categoryId: string) {
    setActiveCategoryId((prev) => (prev === categoryId ? null : categoryId))
  }

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["spendings"] })
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

  return (
    <div className="space-y-6">
      <MonthNavigator year={year} month={month} onChange={handleMonthChange} />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="size-40 animate-pulse rounded-full bg-muted" />
        </div>
      ) : chartData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <div className="mb-4 size-32 rounded-full border-4 border-dashed border-muted" />
          <p className="text-base">No spending this month</p>
        </div>
      ) : (
        <>
          <SpendingsDonutChart
            data={chartData}
            homeCurrency={homeCurrency}
            size="lg"
            activeCategory={activeCategoryId}
            onSliceClick={handleSliceClick}
          />

          {/* Legend */}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
            {chartData.map((d) => (
              <button
                key={d.categoryId}
                type="button"
                className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
                onClick={() => handleSliceClick(d.categoryId)}
              >
                <div
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: d.fill }}
                />
                {d.categoryName}{" "}
                {d.total.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{" "}
                {homeCurrency}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Category filter chip */}
      {activeCategoryId && (
        <div>
          <Badge
            variant="secondary"
            className="cursor-pointer gap-1.5"
            onClick={() => setActiveCategoryId(null)}
          >
            <div
              className="size-2 rounded-full"
              style={{
                backgroundColor: chartData.find(
                  (d) => d.categoryId === activeCategoryId
                )?.fill,
              }}
            />
            {activeCategoryName}
            <IconX className="size-3" />
          </Badge>
        </div>
      )}

      {/* Transaction list */}
      <TransactionList
        transactions={filteredTransactions}
        accounts={accounts}
        categories={categories}
        homeCurrency={homeCurrency}
        showMember={members.length > 1}
        loading={isLoading}
        hasMore={false}
        onLoadMore={() => {}}
        loadingMore={false}
        onEdit={(t) => {
          setEditTransaction(t)
          setFormOpen(true)
        }}
        onReimburse={(t) => setReimburseTransaction(t)}
        onSettle={(t) => settleMutation.mutate(t.id)}
        onDelete={(t) => setDeleteTransaction(t)}
      />

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
        pairedAccountId={null}
        onSubmitTransaction={async (data) => {
          if (editTransaction) {
            const { type: _, ...updateFields } = data
            await updateMutation.mutateAsync({
              id: editTransaction.id,
              body: updateFields,
            })
          }
          setFormOpen(false)
        }}
        onSubmitTransfer={async () => {}}
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
        isTransfer={false}
        onConfirm={async () => {
          if (!deleteTransaction) return
          await deleteMutation.mutateAsync(deleteTransaction.id)
        }}
      />
    </div>
  )
}
