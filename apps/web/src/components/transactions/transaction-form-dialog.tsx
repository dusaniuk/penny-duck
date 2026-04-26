import { useEffect, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@workspace/ui/components/responsive-dialog"
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import type {
  Account,
  Category,
  Member,
  Transaction,
} from "@workspace/api-contract"
import { getCategoryIcon } from "@/lib/category-icons"

type TransactionType = "expense" | "income" | "transfer"

interface TransactionFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction?: Transaction | null
  defaultType?: TransactionType
  accounts: Array<Account>
  categories: Array<Category>
  members: Array<Member>
  currentUserId: string
  exchangeRates?: Record<string, Record<string, number>>
  pairedAccountId?: string | null
  defaultAccountId?: string
  onSubmitTransaction: (data: {
    accountId: string
    type: string
    amount: number
    categoryId: string
    date: string
    note?: string
    settled?: boolean
    madeById?: string
  }) => Promise<void>
  onSubmitTransfer: (data: {
    fromAccountId: string
    toAccountId: string
    amount: number
    date: string
    note?: string
    originalAmount?: number
    originalCurrency?: string
    exchangeRate?: number
    madeById?: string
  }) => Promise<void>
  onDelete?: () => void
}

export function TransactionFormDialog({
  open,
  onOpenChange,
  transaction,
  defaultType = "expense",
  accounts,
  categories,
  members,
  currentUserId,
  exchangeRates,
  pairedAccountId,
  defaultAccountId,
  onSubmitTransaction,
  onSubmitTransfer,
  onDelete,
}: TransactionFormDialogProps) {
  const isEdit = !!transaction
  const isTransferEdit = isEdit && !!transaction.transferId

  const [type, setType] = useState<TransactionType>(defaultType)
  const [amount, setAmount] = useState("")
  const [accountId, setAccountId] = useState("")
  const [categoryId, setCategoryId] = useState("")
  const [date, setDate] = useState("")
  const [note, setNote] = useState("")
  const [unsettled, setUnsettled] = useState(false)
  const [madeById, setMadeById] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Transfer-specific state
  const [fromAccountId, setFromAccountId] = useState("")
  const [toAccountId, setToAccountId] = useState("")
  const [transferExchangeRate, setTransferExchangeRate] = useState("")
  const [receiveAmount, setReceiveAmount] = useState("")

  const activeType: TransactionType = isEdit
    ? isTransferEdit
      ? "transfer"
      : transaction.type
    : type

  // Category hierarchy (expense/income only)
  const parents = categories.filter((c) => c.parentId === null)
  const childrenByParent = categories.reduce<Record<string, Array<Category>>>(
    (acc, c) => {
      if (c.parentId !== null) {
        acc[c.parentId] = [...(acc[c.parentId] ?? []), c]
      }
      return acc
    },
    {}
  )

  // Transfer exchange rate logic
  const fromAccount = accounts.find((a) => a.id === fromAccountId)
  const toAccount = accounts.find((a) => a.id === toAccountId)
  const currenciesDiffer =
    fromAccount && toAccount && fromAccount.currency !== toAccount.currency
  const showTransferExchangeRate = !!currenciesDiffer

  useEffect(() => {
    if (open) {
      if (isTransferEdit) {
        setType("transfer")
      } else if (transaction) {
        setType(transaction.type)
      } else {
        setType(defaultType)
      }
      setAmount(transaction ? transaction.amount.toString() : "")
      setAccountId(transaction?.accountId ?? defaultAccountId ?? "")
      setCategoryId(transaction?.categoryId ?? "")
      setDate(
        transaction?.date
          ? new Date(transaction.date).toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0]
      )
      setNote(transaction?.note ?? "")
      setUnsettled(transaction ? !transaction.settled : false)
      setMadeById(transaction?.madeBy?.id ?? currentUserId)
      setError(null)

      // Transfer fields
      setFromAccountId(transaction?.accountId ?? defaultAccountId ?? "")
      setToAccountId(pairedAccountId ?? "")
      setTransferExchangeRate(transaction?.exchangeRate?.toString() ?? "")
      setReceiveAmount(transaction?.originalAmount?.toString() ?? "")
    }
  }, [open, transaction, defaultType, currentUserId, pairedAccountId, defaultAccountId])

  useEffect(() => {
    if (
      activeType === "transfer" &&
      showTransferExchangeRate &&
      exchangeRates &&
      !isEdit
    ) {
      const fromCurrency = fromAccount.currency
      const toCurrency = toAccount.currency
      const rate = (
        exchangeRates as Record<string, Record<string, number> | undefined>
      )[fromCurrency]?.[toCurrency]
      if (rate !== undefined) {
        setTransferExchangeRate(rate.toFixed(6))
      }
    }
  }, [
    showTransferExchangeRate,
    fromAccount,
    toAccount,
    exchangeRates,
    isEdit,
    activeType,
  ])

  useEffect(() => {
    if (amount && transferExchangeRate && activeType === "transfer") {
      const calc = parseFloat(amount) * parseFloat(transferExchangeRate)
      if (!isNaN(calc)) {
        setReceiveAmount(calc.toFixed(2))
      }
    }
  }, [amount, transferExchangeRate, activeType])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (activeType === "transfer") {
        await onSubmitTransfer({
          fromAccountId,
          toAccountId,
          amount: parseFloat(amount),
          date: new Date(date).toISOString(),
          ...(note ? { note } : {}),
          ...(showTransferExchangeRate && transferExchangeRate && receiveAmount
            ? {
                exchangeRate: parseFloat(transferExchangeRate),
                originalAmount: parseFloat(receiveAmount),
                originalCurrency: toAccount.currency,
              }
            : {}),
          ...(members.length > 1 ? { madeById } : {}),
        })
      } else {
        await onSubmitTransaction({
          accountId,
          type: activeType,
          amount: parseFloat(amount),
          categoryId,
          date: new Date(date).toISOString(),
          ...(note ? { note } : {}),
          settled: !unsettled,
          ...(members.length > 1 ? { madeById } : {}),
        })
      }
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  const toAccountOptions = accounts.filter((a) => a.id !== fromAccountId)

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>
            {isEdit
              ? `Edit ${activeType.charAt(0).toUpperCase() + activeType.slice(1)}`
              : "New Transaction"}
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldGroup className="gap-3 pt-2">
            {!isEdit && (
              <Tabs
                value={type}
                onValueChange={(v) => setType(v as TransactionType)}
              >
                <TabsList className="w-full">
                  <TabsTrigger
                    value="expense"
                    className="flex-1 data-active:bg-red-500/15 data-active:text-red-500"
                  >
                    Expense
                  </TabsTrigger>
                  <TabsTrigger
                    value="income"
                    className="flex-1 data-active:bg-green-500/15 data-active:text-green-500"
                  >
                    Income
                  </TabsTrigger>
                  <TabsTrigger
                    value="transfer"
                    className="flex-1 data-active:bg-violet-500/15 data-active:text-violet-500"
                  >
                    Transfer
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            )}

            <Field>
              <FieldLabel>Amount</FieldLabel>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
                autoFocus
              />
            </Field>

            {activeType !== "transfer" && (
              <Field>
                <FieldLabel>Account</FieldLabel>
                <Select value={accountId} onValueChange={setAccountId} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} — {a.balance.toFixed(2)} {a.currency}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            {activeType === "transfer" && (
              <div className="flex items-end gap-2">
                <Field className="min-w-0 flex-1">
                  <FieldLabel>From</FieldLabel>
                  <Select
                    value={fromAccountId}
                    onValueChange={setFromAccountId}
                    required
                  >
                    <SelectTrigger className="w-full overflow-hidden">
                      <SelectValue placeholder="Source account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name} — {a.balance.toFixed(2)} {a.currency}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <span className="pb-2.5 text-muted-foreground">→</span>
                <Field className="min-w-0 flex-1">
                  <FieldLabel>To</FieldLabel>
                  <Select
                    value={toAccountId}
                    onValueChange={setToAccountId}
                    required
                  >
                    <SelectTrigger className="w-full overflow-hidden">
                      <SelectValue placeholder="Destination account" />
                    </SelectTrigger>
                    <SelectContent>
                      {toAccountOptions.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name} — {a.balance.toFixed(2)} {a.currency}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            )}

            {activeType === "transfer" && showTransferExchangeRate && (
              <div className="rounded-md border border-blue-400/30 bg-blue-400/5 p-3">
                <div className="grid grid-cols-2 gap-2">
                  <Field>
                    <FieldLabel>Rate</FieldLabel>
                    <Input
                      type="number"
                      step="0.000001"
                      value={transferExchangeRate}
                      onChange={(e) => setTransferExchangeRate(e.target.value)}
                      placeholder="41.52"
                      required
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Receive amount</FieldLabel>
                    <Input
                      type="number"
                      step="0.01"
                      value={receiveAmount}
                      onChange={(e) => setReceiveAmount(e.target.value)}
                      placeholder="4152.00"
                      required
                    />
                  </Field>
                </div>
              </div>
            )}

            {members.length > 1 && (
              <Field>
                <FieldLabel>Made by</FieldLabel>
                <Select value={madeById} onValueChange={setMadeById} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select member" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        <span className="flex items-center gap-2">
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                            {m.name.charAt(0).toUpperCase()}
                          </span>
                          {m.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            {activeType !== "transfer" && (
              <Field>
                <FieldLabel>Category</FieldLabel>
                <Select
                  value={categoryId}
                  onValueChange={setCategoryId}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {parents.map((parent) => {
                      const parentIcon = getCategoryIcon(parent.icon)
                      return (
                        <div key={parent.id}>
                          <SelectItem value={parent.id}>
                            <span className="flex items-center gap-1.5">
                              {parentIcon ? (
                                <parentIcon.component className="size-4" />
                              ) : parent.icon ? (
                                parent.icon
                              ) : null}
                              {parent.name}
                            </span>
                          </SelectItem>
                          {(childrenByParent[parent.id] ?? []).map((child) => {
                            const childIcon = getCategoryIcon(child.icon)
                            return (
                              <SelectItem key={child.id} value={child.id}>
                                <span className="flex items-center gap-1.5 pl-4">
                                  {childIcon ? (
                                    <childIcon.component className="size-4" />
                                  ) : child.icon ? (
                                    child.icon
                                  ) : null}
                                  {child.name}
                                </span>
                              </SelectItem>
                            )
                          })}
                        </div>
                      )
                    })}
                  </SelectContent>
                </Select>
              </Field>
            )}

            <Field>
              <FieldLabel>Date</FieldLabel>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </Field>

            <Field>
              <FieldLabel>Note</FieldLabel>
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional note"
                maxLength={500}
              />
            </Field>

            {activeType !== "transfer" && (
              <div className="flex gap-3">
                {!isEdit && (
                  <button
                    type="button"
                    onClick={() => setUnsettled(!unsettled)}
                    className={`rounded-full border px-2.5 py-0.5 text-sm font-medium transition-colors ${
                      unsettled
                        ? "border-amber-400 bg-amber-400/20 text-amber-400"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {unsettled ? "Unsettled" : "Mark unsettled"}
                  </button>
                )}
                {isEdit && !isTransferEdit && (
                  <button
                    type="button"
                    onClick={() => setUnsettled(!unsettled)}
                    className={`rounded-full border px-2.5 py-0.5 text-sm font-medium transition-colors ${
                      unsettled
                        ? "border-amber-400 bg-amber-400/20 text-amber-400"
                        : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {unsettled ? "Unsettled" : "Mark unsettled"}
                  </button>
                )}
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex items-center justify-between pt-1">
              <div className="flex gap-2">
                {isEdit && onDelete && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={onDelete}
                    disabled={loading}
                  >
                    Delete
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading ? "Saving…" : isEdit ? "Save Changes" : "Create"}
                </Button>
              </div>
            </div>
          </FieldGroup>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
