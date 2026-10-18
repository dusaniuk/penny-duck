import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router"
import { useQuery } from "@tanstack/react-query"
import { api, unwrap } from "@/lib/api"
import { leafAccountsOf } from "@/lib/accounts"
import { PositionsTable } from "@/components/investments/positions-table"
import { toTypographicMinus } from "@/lib/money"

export const Route = createFileRoute("/_app/investments/$accountId")({
  staticData: { breadcrumb: "Account" },
  component: AccountInvestmentsPage,
})

function AccountInvestmentsPage() {
  const { accountId } = useParams({ from: "/_app/investments/$accountId" })
  const navigate = useNavigate()

  const { data: positionsData } = useQuery({
    queryKey: ["positions"],
    queryFn: () => unwrap(api.positions.$get()),
  })
  const positions = (positionsData?.positions ?? []).filter(
    (p) => p.accountId === accountId
  )

  const { data: accountsData } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => unwrap(api.accounts.$get()),
  })
  const account = leafAccountsOf(accountsData, { includeArchived: true }).find(
    (a) => a.id === accountId
  )

  return (
    <div className="space-y-6">
      {account && (
        <div>
          <h1 className="font-heading text-2xl font-semibold">
            {account.name}
          </h1>
          <p className="text-muted-foreground">
            Cash: {toTypographicMinus(account.balance.toFixed(2))}{" "}
            {account.currency}
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
