import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router"
import { tsr } from "@/lib/api"
import { PositionsTable } from "@/components/investments/positions-table"

export const Route = createFileRoute("/_app/investments/$accountId")({
  staticData: { breadcrumb: "Account" },
  component: AccountInvestmentsPage,
})

function AccountInvestmentsPage() {
  const { accountId } = useParams({ from: "/_app/investments/$accountId" })
  const navigate = useNavigate()

  const { data: positionsData } = tsr.investments.listPositions.useQuery({
    queryKey: ["positions"],
  })
  const positions = (positionsData?.body.positions ?? []).filter(
    (p) => p.accountId === accountId
  )

  const { data: accountsData } = tsr.accounts.list.useQuery({
    queryKey: ["accounts"],
  })
  const account = accountsData?.body.find((a) => a.id === accountId)

  return (
    <div className="space-y-6">
      {account && (
        <div>
          <h1 className="font-heading text-2xl font-semibold">
            {account.name}
          </h1>
          <p className="text-muted-foreground">
            Cash: {account.balance.toFixed(2)} {account.currency}
          </p>
        </div>
      )}
      <PositionsTable
        positions={positions}
        onRowClick={(p) =>
          navigate({
            to: "/investments/$accountId/$symbol",
            params: { accountId, symbol: p.symbol },
          })
        }
      />
    </div>
  )
}
