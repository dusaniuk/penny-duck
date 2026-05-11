import { createFileRoute } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import type { Account, Category } from "@workspace/api-contract"
import { api } from "@/lib/api"
import { SpendingsCard } from "@/components/spendings/spendings-card"
import { BalanceCard } from "@/components/dashboard/balance-card"
import { IncomeExpensesCard } from "@/components/dashboard/income-expenses-card"
import { TransactionFab } from "@/components/transactions/transaction-fab"
import { useTransactionCreate } from "@/components/transactions/use-transaction-create"

export const Route = createFileRoute("/_app/dashboard")({
  staticData: { breadcrumb: "Dashboard" },
  component: DashboardPage,
})

function DashboardPage() {
  const { data: categoriesData } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await api.categories.$get()
      if (!res.ok) throw await res.json()
      return res.json()
    },
  })
  const categories: Array<Category> = categoriesData ?? []

  const { data: accountsData, isLoading: accountsLoading } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const res = await api.accounts.$get()
      if (!res.ok) throw await res.json()
      return res.json()
    },
  })
  const accounts: Array<Account> = accountsData ?? []

  const { data: meData } = useQuery({
    queryKey: ["users", "me"],
    queryFn: async () => {
      const res = await api.users.me.$get()
      if (!res.ok) throw await res.json()
      return res.json()
    },
  })
  const homeCurrency = meData?.homeCurrency ?? "UAH"

  const { openCreate, dialog: createDialog } = useTransactionCreate()

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <BalanceCard
          accounts={accounts}
          homeCurrency={homeCurrency}
          loading={accountsLoading}
        />
        <SpendingsCard categories={categories} homeCurrency={homeCurrency} />
        <IncomeExpensesCard />
      </div>
      <div className="min-h-screen flex-1 rounded-xl bg-muted/50 md:min-h-min" />
      <TransactionFab onOpen={openCreate} />
      {createDialog}
    </>
  )
}
