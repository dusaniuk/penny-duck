import {
  IconAlertCircle,
  IconCash,
  IconCheck,
  IconDotsVertical,
  IconEdit,
  IconTrash,
} from "@tabler/icons-react"
import { Amount } from "@workspace/ui/components/amount"
import { formatMoney } from "@workspace/ui/lib/money"
import { useLocale } from "@workspace/ui/components/locale-provider"
import { cn } from "@workspace/ui/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import type { Account, Category, Transaction } from "@workspace/api-contract"
import { getIcon } from "@/lib/icons"

type AccountData = Account
type CategoryData = Category
type TransactionData = Transaction

interface TransactionRowProps {
  transaction: TransactionData
  accounts: Array<AccountData>
  categories: Array<CategoryData>
  pairedAccountName?: string | null
  showMember?: boolean
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
  showMember,
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

  const locale = useLocale()

  const amountTone = isReimbursement
    ? undefined
    : isTransfer
      ? "transfer"
      : isExpense
        ? "expense"
        : "income"

  const signedAmount =
    isExpense && !isReimbursement && !isTransfer
      ? -transaction.amount
      : transaction.amount

  function renderLeft() {
    if (isReimbursement) {
      return (
        <div className="flex items-center gap-2.5 overflow-hidden">
          <span className="shrink-0 text-base text-warning">↩</span>
          <div className="min-w-0">
            <p className="truncate text-base font-medium text-warning">
              Return
            </p>
            <p className="truncate text-sm text-muted-foreground">
              {transaction.note ?? account?.name ?? "Unknown"}
            </p>
          </div>
        </div>
      )
    }

    if (isTransfer) {
      return (
        <div className="flex items-center gap-2.5 overflow-hidden">
          <span className="shrink-0 text-base text-muted-foreground">↔</span>
          <div className="min-w-0">
            <p className="truncate text-base font-medium">Transfer</p>
            <p className="truncate text-sm text-muted-foreground">
              {account?.name ?? "Unknown"}
              {pairedAccountName && ` → ${pairedAccountName}`}
              {transaction.exchangeRate != null && (
                <span className="text-info">
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
        <span className="flex size-5 shrink-0 items-center justify-center text-base">
          {(() => {
            const resolved = getIcon(category?.icon ?? null)
            if (resolved) return <resolved.component className="size-4" />
            return category?.icon ?? "📁"
          })()}
        </span>
        <div className="min-w-0">
          <p
            className={`flex items-center gap-1.5 truncate text-base font-medium ${!category ? "text-muted-foreground italic" : ""}`}
          >
            <span className="truncate">
              {category?.name ?? "Uncategorized"}
            </span>
          </p>
          <p className="truncate text-sm text-muted-foreground">
            {isUnsettled && <span className="text-warning">unsettled </span>}
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

  function renderMemberBadge() {
    if (!showMember || !transaction.madeBy) return null
    return (
      <span
        className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] leading-none font-medium text-primary"
        title={transaction.madeBy.name}
      >
        {transaction.madeBy.name.charAt(0).toUpperCase()}
      </span>
    )
  }

  function renderRight() {
    return (
      <div className="min-w-0 text-right">
        <p className="truncate text-base font-semibold">
          <Amount
            value={signedAmount}
            signed={!isTransfer}
            tone={amountTone}
            currency={account?.currency}
            className={cn(isReimbursement && "text-warning")}
          />
        </p>
        <p className="flex items-center justify-end gap-1 text-sm text-muted-foreground">
          {renderMemberBadge()}
          <span className="min-w-0 truncate">
            {isTransfer && transaction.originalAmount != null
              ? `→ ${formatMoney(transaction.originalAmount, { locale, currency: transaction.originalCurrency ?? undefined })}`
              : (account?.name ?? "")}
          </span>
        </p>
      </div>
    )
  }

  return (
    <div
      className={`flex w-full items-center justify-between gap-3 rounded-md px-0 py-2.5 text-left transition-colors sm:px-3 ${
        isUnsettled ? "border-l-3 border-l-warning bg-warning/5" : ""
      }`}
    >
      {renderLeft()}
      <div className="flex items-center gap-2">
        {renderRight()}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              data-testid="transaction-actions"
              className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <IconDotsVertical className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            <DropdownMenuItem onSelect={() => onEdit(transaction)}>
              <IconEdit />
              Edit
            </DropdownMenuItem>

            {canReimburse && onReimburse && (
              <DropdownMenuItem onSelect={() => onReimburse(transaction)}>
                <IconCash />
                Add reimbursement
              </DropdownMenuItem>
            )}

            {!isTransfer && (
              <DropdownMenuItem onSelect={() => onSettle(transaction)}>
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
