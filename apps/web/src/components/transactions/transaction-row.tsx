import {
  IconAlertCircle,
  IconCash,
  IconCheck,
  IconDotsVertical,
  IconEdit,
  IconTrash,
} from "@tabler/icons-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import type { Account, Category, Transaction } from "@workspace/api-contract"
import { getCategoryIcon } from "@/lib/category-icons"

type AccountData = Account
type CategoryData = Category
type TransactionData = Transaction

interface TransactionRowProps {
  transaction: TransactionData
  accounts: Array<AccountData>
  categories: Array<CategoryData>
  pairedAccountName?: string | null
  onEdit: (transaction: TransactionData) => void
  onReimburse?: (transaction: TransactionData) => void
  onSettle: (transaction: TransactionData) => void
  onDelete: (transaction: TransactionData) => void
}

export function TransactionRow({
  transaction,
  accounts,
  categories,
  pairedAccountName,
  onEdit,
  onReimburse,
  onSettle,
  onDelete,
}: TransactionRowProps) {
  const account = transaction.accountId
    ? accounts.find((a) => a.id === transaction.accountId)
    : null
  const category = categories.find((c) => c.id === transaction.categoryId)
  const isTransfer = transaction.transferId != null
  const isReimbursement = transaction.reimbursementId != null
  const isExpense = transaction.type === "expense"
  const isUnsettled = !transaction.settled

  const canReimburse =
    isUnsettled && isExpense && !isTransfer && !isReimbursement

  const amountColor = isReimbursement
    ? "text-amber-400"
    : isTransfer
      ? "text-violet-400"
      : isExpense
        ? "text-red-400"
        : "text-green-400"

  const amountPrefix = isReimbursement
    ? "+"
    : isTransfer
      ? ""
      : isExpense
        ? "-"
        : "+"

  function renderLeft() {
    if (isReimbursement) {
      return (
        <div className="flex items-center gap-2.5 overflow-hidden">
          <span className="shrink-0 text-sm text-amber-400">↩</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-amber-400">
              Return
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {transaction.note ?? account?.name ?? "Unknown"}
            </p>
          </div>
        </div>
      )
    }

    if (isTransfer) {
      return (
        <div className="flex items-center gap-2.5 overflow-hidden">
          <span className="shrink-0 text-sm text-muted-foreground">↔</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">Transfer</p>
            <p className="truncate text-xs text-muted-foreground">
              {account?.name ?? "Unknown"}
              {pairedAccountName && ` → ${pairedAccountName}`}
              {transaction.exchangeRate != null && (
                <span className="text-blue-400">
                  {" "}
                  · rate {transaction.exchangeRate}
                </span>
              )}
            </p>
          </div>
        </div>
      )
    }

    return (
      <div className="flex items-center gap-2.5 overflow-hidden">
        <span className="flex size-5 shrink-0 items-center justify-center text-sm">
          {(() => {
            const resolved = getCategoryIcon(category?.icon ?? null)
            if (resolved) return <resolved.component className="size-4" />
            return category?.icon ?? "📁"
          })()}
        </span>
        <div className="min-w-0">
          <p
            className={`truncate text-sm font-medium ${!category ? "italic text-muted-foreground" : ""}`}
          >
            {category?.name ?? "Uncategorized"}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {isUnsettled && (
              <span className="text-amber-400">unsettled </span>
            )}
            {transaction.note && (
              <span>
                {isUnsettled ? "· " : ""}
                {transaction.note}
              </span>
            )}
          </p>
        </div>
      </div>
    )
  }

  function renderRight() {
    return (
      <div className="shrink-0 text-right">
        <p className={`text-sm font-semibold tabular-nums ${amountColor}`}>
          {amountPrefix}
          {transaction.amount.toFixed(2)}
        </p>
        <p className="text-xs text-muted-foreground">
          {isTransfer && transaction.originalAmount != null ? (
            `→ ${transaction.originalAmount.toFixed(2)} ${transaction.originalCurrency}`
          ) : (
            account?.name ?? ""
          )}
        </p>
      </div>
    )
  }

  return (
    <div
      className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left transition-colors ${
        isUnsettled
          ? "border-l-3 border-l-amber-400 bg-amber-400/5"
          : ""
      }`}
    >
      {renderLeft()}
      <div className="flex items-center gap-2">
        {renderRight()}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <IconDotsVertical className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onEdit(transaction)}>
              <IconEdit />
              Edit
            </DropdownMenuItem>

            {canReimburse && onReimburse && (
              <DropdownMenuItem
                className="text-amber-500 focus:text-amber-500"
                onSelect={() => onReimburse(transaction)}
              >
                <IconCash />
                Add reimbursement
              </DropdownMenuItem>
            )}

            {!isTransfer && (
              <DropdownMenuItem
                className={
                  isUnsettled
                    ? "text-green-500 focus:text-green-500"
                    : undefined
                }
                onSelect={() => onSettle(transaction)}
              >
                {isUnsettled ? <IconCheck /> : <IconAlertCircle />}
                {isUnsettled ? "Mark settled" : "Mark unsettled"}
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            <DropdownMenuItem
              variant="destructive"
              onSelect={() => onDelete(transaction)}
            >
              <IconTrash />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}
