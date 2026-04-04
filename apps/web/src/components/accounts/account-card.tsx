import { IconDotsVertical, IconEdit, IconTrash } from "@tabler/icons-react"
import { Card, CardContent, CardHeader } from "@workspace/ui/components/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"

export interface AccountData {
  id: string
  name: string
  type: string
  currency: string
  balance: number
}

interface AccountCardProps {
  account: AccountData
  onEdit: (account: AccountData) => void
  onDelete: (account: AccountData) => void
  onClick: (account: AccountData) => void
}

export function AccountCard({
  account,
  onEdit,
  onDelete,
  onClick,
}: AccountCardProps) {
  return (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={() => onClick(account)}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted-foreground">
              {account.type} · {account.currency}
            </p>
            <p className="mt-0.5 truncate font-heading text-sm font-medium">
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
            <DropdownMenuContent align="end">
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
        <p className="text-xl font-semibold tabular-nums">
          {account.balance.toFixed(2)}{" "}
          <span className="text-sm font-normal text-muted-foreground">
            {account.currency}
          </span>
        </p>
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
      className="flex min-h-[100px] w-full cursor-pointer items-center justify-center rounded-lg border border-dashed border-foreground/20 text-sm text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
    >
      + Add Account
    </button>
  )
}
