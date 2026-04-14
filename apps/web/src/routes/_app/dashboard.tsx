import { createFileRoute } from "@tanstack/react-router"
import type { Account, Category } from "@workspace/api-contract"
import { tsr } from "@/lib/api"
import { SpendingsCard } from "@/components/spendings/spendings-card"
import { BalanceCard } from "@/components/dashboard/balance-card"

export const Route = createFileRoute("/_app/dashboard")({
  staticData: { breadcrumb: "Dashboard" },
  component: DashboardPage,
})

function DashboardPage() {
  const { data: categoriesData } = tsr.categories.list.useQuery({
    queryKey: ["categories"],
  })
  const categories: Array<Category> = categoriesData?.body ?? []

  const { data: accountsData, isLoading: accountsLoading } =
    tsr.accounts.list.useQuery({
      queryKey: ["accounts"],
    })
  const accounts: Array<Account> = accountsData?.body ?? []

  const { data: meData } = tsr.users.getMe.useQuery({
    queryKey: ["users", "me"],
  })
  const homeCurrency = meData?.body.homeCurrency ?? "UAH"

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <BalanceCard
          accounts={accounts}
          homeCurrency={homeCurrency}
          loading={accountsLoading}
        />
        <SpendingsCard categories={categories} homeCurrency={homeCurrency} />
        <div className="rounded-xl bg-muted/50" />
      </div>
      <div className="min-h-screen flex-1 rounded-xl bg-muted/50 md:min-h-min" />
    </>
  )
}
