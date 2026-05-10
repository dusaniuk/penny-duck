import { Outlet, createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_app/investments")({
  staticData: { breadcrumb: "Investments" },
  component: InvestmentsLayout,
})

function InvestmentsLayout() {
  return <Outlet />
}
