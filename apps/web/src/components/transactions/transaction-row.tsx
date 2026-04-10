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
  onClick: (transaction: TransactionData) => void
}

export function TransactionRow({
  transaction,
  accounts,
  categories,
  pairedAccountName,
  onClick,
}: TransactionRowProps) {
  const account = transaction.accountId
    ? accounts.find((a) => a.id === transaction.accountId)
    : null
  const category = categories.find((c) => c.id === transaction.categoryId)
  const isTransfer = transaction.transferId != null
  const isExpense = transaction.type === "expense"
  const isUnsettled = transaction.myShare != null && !transaction.settled

  const amountColor = isTransfer
    ? "text-violet-400"
    : isExpense
      ? "text-red-400"
      : "text-green-400"

  const amountPrefix = isTransfer ? "" : isExpense ? "-" : "+"

  function renderLeft() {
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
              <span className="text-amber-400">
                my share: {transaction.myShare?.toFixed(2)}{" "}
              </span>
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
    <button
      type="button"
      onClick={() => onClick(transaction)}
      className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2.5 text-left transition-colors hover:bg-muted/50 ${
        isUnsettled
          ? "border-l-3 border-l-amber-400 bg-amber-400/5"
          : ""
      }`}
    >
      {renderLeft()}
      {renderRight()}
    </button>
  )
}
