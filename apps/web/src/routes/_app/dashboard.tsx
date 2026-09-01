import { createFileRoute } from "@tanstack/react-router"
import { NetWorthCard } from "@/components/dashboard/net-worth-card"
import { SpendingByCategoryCard } from "@/components/dashboard/spending-by-category-card"
import { TransactionFab } from "@/components/transactions/transaction-fab"
import { useTransactionCreate } from "@/components/transactions/use-transaction-create"

export const Route = createFileRoute("/_app/dashboard")({
  staticData: { breadcrumb: "Dashboard" },
  component: DashboardPage,
})

function DashboardPage() {
  const { openCreate, dialog: createDialog } = useTransactionCreate()

  return (
    <>
      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2">
          <NetWorthCard />
        </div>
        <SpendingByCategoryCard />
      </div>
      <TransactionFab onOpen={openCreate} />
      {createDialog}
    </>
  )
}
