import { Link } from "@tanstack/react-router"
import { IconWallet } from "@tabler/icons-react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import type { Account } from "@workspace/api-contract"

interface BalanceCardProps {
  accounts: Array<Account>
  homeCurrency: string
  loading: boolean
}

export function BalanceCard({
  accounts,
  homeCurrency,
  loading,
}: BalanceCardProps) {
  const totalBalance = accounts.reduce(
    (sum, account) => sum + account.homeBalance,
    0,
  )

  return (
    <Link to="/accounts" className="block h-full">
      <Card className="flex h-full flex-col transition-colors hover:bg-muted/50">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium">Total Balance</CardTitle>
          <IconWallet className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="flex flex-1 items-center justify-center">
          {loading ? (
            <div className="h-8 w-32 animate-pulse rounded bg-muted" />
          ) : (
            <p className="text-2xl font-bold tabular-nums">
              {totalBalance.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}{" "}
              <span className="text-base font-normal text-muted-foreground">
                {homeCurrency}
              </span>
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
