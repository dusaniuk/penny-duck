import { createFileRoute } from "@tanstack/react-router"
import type { Category } from "@workspace/api-contract"
import { tsr } from "@/lib/api"
import { SpendingsCard } from "@/components/spendings/spendings-card"

export const Route = createFileRoute("/_app/dashboard")({
  staticData: { breadcrumb: "Dashboard" },
  component: DashboardPage,
})

function DashboardPage() {
  const { data: categoriesData } = tsr.categories.list.useQuery({
    queryKey: ["categories"],
  })
  const categories: Array<Category> = categoriesData?.body ?? []

  const { data: meData } = tsr.users.getMe.useQuery({
    queryKey: ["users", "me"],
  })
  const homeCurrency = meData?.body.homeCurrency ?? "UAH"

  return (
    <>
      <div className="grid auto-rows-min gap-4 md:grid-cols-3">
        <SpendingsCard categories={categories} homeCurrency={homeCurrency} />
        <div className="aspect-video rounded-xl bg-muted/50" />
        <div className="aspect-video rounded-xl bg-muted/50" />
      </div>
      <div className="min-h-screen flex-1 rounded-xl bg-muted/50 md:min-h-min" />
    </>
  )
}
