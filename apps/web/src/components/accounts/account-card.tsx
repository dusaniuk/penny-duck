import { IconDotsVertical, IconEdit, IconStar, IconTrash } from "@tabler/icons-react"
import { Link } from "@tanstack/react-router"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent, CardHeader } from "@workspace/ui/components/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import type { Account } from "@workspace/api-contract"

export type AccountData = Account

interface AccountCardProps {
  account: AccountData
  onEdit: (account: AccountData) => void
  onDelete: (account: AccountData) => void
  onSetDefault: (account: AccountData) => void
  onClick: (account: AccountData) => void
  holdings?: number
}

function fmtMoney(n: number) {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function AccountCard({
  account,
  onEdit,
  onDelete,
  onSetDefault,
  onClick,
  holdings,
}: AccountCardProps) {
  const isBrokerageWithHoldings =
    account.type === "brokerage" && holdings !== undefined
  const primary = isBrokerageWithHoldings ? holdings : account.balance
  const showCashBadge = isBrokerageWithHoldings && account.balance !== 0
  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={() => onClick(account)}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>
                {account.type} · {account.currency}
              </span>
              {account.isDefault && (
                <Badge
                  variant="secondary"
                  className="text-[10px] uppercase tracking-wide"
                >
                  Default
                </Badge>
              )}
            </p>
            <p className="mt-0.5 truncate font-heading text-base font-medium">
              {account.name}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              className="shrink-0 rounded p-0.5 hover:bg-accent"
              onClick={(e) => e.stopPropagation()}
            >
              <IconDotsVertical className="size-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[10rem]">
              <DropdownMenuItem
                disabled={account.isDefault}
                onClick={(e) => {
                  e.stopPropagation()
                  onSetDefault(account)
                }}
              >
                <IconStar />
                <span className="whitespace-nowrap">Set as default</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  onEdit(account)
                }}
              >
                <IconEdit />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={(e) => {
                  e.stopPropagation()
                  onDelete(account)
                }}
              >
                <IconTrash />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-semibold tabular-nums">
          {fmtMoney(primary)}{" "}
          <span className="text-base font-normal text-muted-foreground">
            {account.currency}
          </span>
        </p>
        {showCashBadge && (
          <p className="mt-1 text-xs text-muted-foreground tabular-nums">
            {account.balance >= 0 ? "+ " : "− "}
            {fmtMoney(Math.abs(account.balance))} {account.currency} cash
          </p>
        )}
        {account.type === "brokerage" && (
          <Link
            to="/investments/$accountId"
            params={{ accountId: account.id }}
            onClick={(e) => e.stopPropagation()}
            className="mt-2 inline-block text-xs text-muted-foreground underline-offset-2 hover:underline"
          >
            View investments →
          </Link>
        )}
      </CardContent>
    </Card>
  )
}

interface AddAccountCardProps {
  onClick: () => void
}

export function AddAccountCard({ onClick }: AddAccountCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[100px] w-full cursor-pointer items-center justify-center rounded-lg border border-dashed border-foreground/20 text-base text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
    >
      + Add Account
    </button>
  )
}
