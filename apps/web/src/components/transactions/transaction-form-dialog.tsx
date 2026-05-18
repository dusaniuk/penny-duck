import { useEffect, useMemo, useRef, useState } from "react"
import {
  IconAlertTriangle,
  IconArrowRight,
  IconArrowsRightLeft,
  IconCalendar,
  IconMinus,
  IconNote,
  IconPlus,
  IconX,
} from "@tabler/icons-react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Calendar } from "@workspace/ui/components/calendar"
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@workspace/ui/components/input-group"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@workspace/ui/components/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { useIsMobile } from "@workspace/ui/hooks/use-mobile"
import { cn } from "@workspace/ui/lib/utils"
import {
  TransactionAccountBlock,
  TransactionAccountChips,
} from "./transaction-account-chips"
import { TransactionCategoryGrid } from "./transaction-category-grid"
import { TransactionCategoryPicker } from "./transaction-category-picker"
import type {
  Account,
  AccountUsageItem,
  Category,
  CategoryUsageItem,
  Member,
  Transaction,
} from "@workspace/api-contract"

type TransactionType = "expense" | "income" | "transfer"
type View = "form" | "picker"

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
  accountUsage?: ReadonlyArray<AccountUsageItem>
  categoryUsage?: ReadonlyArray<CategoryUsageItem>
  recentCategoryIds?: ReadonlyArray<string>
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
  onCreateCategory?: () => void
}

// Per-type accent colors used on the eyebrow, amount sign, and submit button.
// Values are CSS variables defined in globals.css so they adapt per theme
// (paler hues on the dark shell, darker/saturated hues on light bg).
// `solidSubmit` is the CTA bg — transfer swaps to violet distinct from orange.
const TYPE_PALETTE: Record<
  TransactionType,
  {
    ink: string
    inkBg: string
    inkRing: string
    solidSubmit: string
    submitFg: string
  }
> = {
  expense: {
    ink: "var(--tx-expense-ink)",
    inkBg: "var(--tx-expense-ink-bg)",
    inkRing: "var(--tx-expense-ink-ring)",
    solidSubmit: "var(--tx-submit-default-bg)",
    submitFg: "var(--tx-submit-default-fg)",
  },
  income: {
    ink: "var(--tx-income-ink)",
    inkBg: "var(--tx-income-ink-bg)",
    inkRing: "var(--tx-income-ink-ring)",
    solidSubmit: "var(--tx-submit-default-bg)",
    submitFg: "var(--tx-submit-default-fg)",
  },
  transfer: {
    ink: "var(--tx-transfer-ink)",
    inkBg: "var(--tx-transfer-ink-bg)",
    inkRing: "var(--tx-transfer-ink-ring)",
    solidSubmit: "var(--tx-submit-transfer-bg)",
    submitFg: "var(--tx-submit-transfer-fg)",
  },
}

function todayIso(): string {
  return new Date().toISOString().split("T")[0]
}
function yesterdayIso(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().split("T")[0]
}
function formatDDMM(iso: string): string {
  const parts = iso.split("-")
  if (parts.length !== 3) return iso
  return `${parts[2]}.${parts[1]}`
}
// Parse a YYYY-MM-DD string as a local-time Date. Using `new Date(iso)`
// parses as UTC midnight, which shifts the day for users west of UTC.
function parseLocalDate(iso: string): Date | undefined {
  const parts = iso.split("-").map(Number)
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return undefined
  return new Date(parts[0], parts[1] - 1, parts[2])
}
function toLocalIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

// Shell utility classes shared between desktop and mobile variants.
// Desktop is a 440px floating card with drop shadow; mobile is a
// full-screen Dialog (slides up from the bottom) — Vaul Drawer was tried
// but its viewport-tracking behavior fights soft-keyboard open/close.
// Dark mode keeps the original premium-dark gradient; light mode uses
// the flat card surface from the design tokens.
const SHELL_BASE =
  "flex flex-col gap-[14px] bg-card text-foreground [font-family:Inter,system-ui,sans-serif] dark:bg-linear-to-b dark:from-[#131418] dark:to-[#0c0d10] dark:text-[#e8e8e8]"
const SHELL_DESKTOP =
  "w-[440px] rounded-[18px] border border-border p-[18px_18px_16px] shadow-[0_30px_80px_rgba(0,0,0,0.18)] dark:border-foreground/[0.06] dark:shadow-[0_30px_80px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,255,255,0.02)]"
const SHELL_MOBILE =
  "min-h-dvh w-full px-4 pt-[max(env(safe-area-inset-top),16px)] pb-[max(env(safe-area-inset-bottom),22px)]"

const SECTION_LABEL =
  "mb-2 text-[11px] font-semibold tracking-[0.06em] uppercase text-muted-foreground"

const ICON_BTN =
  "size-[30px] bg-transparent text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground"

export function TransactionFormDialog(props: TransactionFormDialogProps) {
  const isMobile = useIsMobile()
  const { open, onOpenChange } = props
  const title = props.transaction ? "Edit transaction" : "New transaction"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "gap-0 rounded-none border-0 bg-transparent p-0 ring-0",
          isMobile
            ? "top-0 left-0 h-dvh max-w-none translate-x-0 translate-y-0 data-open:slide-in-from-bottom-4 data-closed:slide-out-to-bottom-4"
            : "w-[440px] max-w-none"
        )}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {isMobile ? (
          // Scroll lives on this inner flex wrapper rather than on the Dialog
          // content. Touch scrolling on iOS Safari is more reliable here than
          // on a position:fixed h-dvh container, and overflow-x-hidden
          // localises any rogue horizontal overflow without clipping the
          // scroll axis.
          <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto">
            <TransactionModalBody {...props} variant="mobile" />
          </div>
        ) : (
          <TransactionModalBody {...props} variant="desktop" />
        )}
      </DialogContent>
    </Dialog>
  )
}

interface ModalBodyProps extends TransactionFormDialogProps {
  variant: "desktop" | "mobile"
}

function TransactionModalBody({
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
  accountUsage = [],
  categoryUsage = [],
  recentCategoryIds = [],
  onSubmitTransaction,
  onSubmitTransfer,
  onDelete,
  onCreateCategory,
  variant,
}: ModalBodyProps) {
  const isEdit = !!transaction
  const isTransferEdit = isEdit && !!transaction.transferId
  const isMobile = variant === "mobile"

  const [type, setType] = useState<TransactionType>(defaultType)
  const [amount, setAmount] = useState("")
  const [accountId, setAccountId] = useState("")
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [date, setDate] = useState(todayIso())
  const [note, setNote] = useState("")
  const [unsettled, setUnsettled] = useState(false)
  const [madeById, setMadeById] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<View>("form")
  const [datePickerOpen, setDatePickerOpen] = useState(false)

  const [fromAccountId, setFromAccountId] = useState("")
  const [toAccountId, setToAccountId] = useState("")
  const [transferExchangeRate, setTransferExchangeRate] = useState("")
  const [receiveAmount, setReceiveAmount] = useState("")

  const formRef = useRef<HTMLFormElement | null>(null)
  const amountRef = useRef<HTMLInputElement | null>(null)

  const activeType: TransactionType = isEdit
    ? isTransferEdit
      ? "transfer"
      : transaction.type
    : type

  const typedCategories =
    activeType === "transfer"
      ? []
      : categories.filter((c) => c.type === activeType)

  // Sort: user-default first, then most-used, then alphabetical. Applied to
  // chips and to the transfer From/To selects so order stays consistent
  // across tabs.
  const sortedAccounts = useMemo(() => {
    const usageMap = new Map(accountUsage.map((u) => [u.accountId, u.count]))
    return [...accounts].sort((a, b) => {
      if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1
      const ua = usageMap.get(a.id) ?? 0
      const ub = usageMap.get(b.id) ?? 0
      if (ua !== ub) return ub - ua
      return a.name.localeCompare(b.name)
    })
  }, [accounts, accountUsage])

  const fromAccount = accounts.find((a) => a.id === fromAccountId)
  const toAccount = accounts.find((a) => a.id === toAccountId)
  const currenciesDiffer =
    !!fromAccount && !!toAccount && fromAccount.currency !== toAccount.currency
  const showTransferExchangeRate = currenciesDiffer

  useEffect(() => {
    if (!open) return
    if (isTransferEdit) {
      setType("transfer")
    } else if (transaction) {
      setType(transaction.type)
    } else {
      setType(defaultType)
    }
    setAmount(transaction ? transaction.amount.toString() : "")
    setAccountId(
      transaction?.accountId ?? defaultAccountId ?? accounts[0]?.id ?? ""
    )
    setCategoryId(transaction?.categoryId ?? null)
    setDate(
      transaction?.date
        ? new Date(transaction.date).toISOString().split("T")[0]
        : todayIso()
    )
    setNote(transaction?.note ?? "")
    setUnsettled(transaction ? !transaction.settled : false)
    setMadeById(transaction?.madeBy?.id ?? currentUserId)
    setError(null)
    setView("form")

    setFromAccountId(
      transaction?.accountId ?? defaultAccountId ?? accounts[0]?.id ?? ""
    )
    setToAccountId(pairedAccountId ?? "")
    setTransferExchangeRate(transaction?.exchangeRate?.toString() ?? "")
    setReceiveAmount(transaction?.originalAmount?.toString() ?? "")
  }, [
    open,
    transaction,
    defaultType,
    currentUserId,
    pairedAccountId,
    defaultAccountId,
    accounts,
    isTransferEdit,
  ])

  useEffect(() => {
    if (
      activeType === "transfer" &&
      showTransferExchangeRate &&
      exchangeRates &&
      !isEdit &&
      fromAccount &&
      toAccount
    ) {
      const rate = exchangeRates[fromAccount.currency]?.[toAccount.currency]
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

  const palette = TYPE_PALETTE[activeType]
  const currency =
    activeType === "transfer"
      ? (fromAccount?.currency ?? "UAH")
      : (accounts.find((a) => a.id === accountId)?.currency ?? "UAH")

  const datePreset: "today" | "yesterday" | "custom" =
    date === todayIso()
      ? "today"
      : date === yesterdayIso()
        ? "yesterday"
        : "custom"

  const submitDisabled = (() => {
    if (loading) return true
    if (!amount || parseFloat(amount) <= 0) return true
    if (activeType === "transfer") {
      if (!fromAccountId || !toAccountId) return true
      if (fromAccountId === toAccountId) return true
    } else {
      if (!accountId) return true
      if (!categoryId) return true
    }
    return false
  })()

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    if (submitDisabled) return
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
          ...(showTransferExchangeRate &&
          transferExchangeRate &&
          receiveAmount &&
          toAccount
            ? {
                exchangeRate: parseFloat(transferExchangeRate),
                originalAmount: parseFloat(receiveAmount),
                originalCurrency: toAccount.currency,
              }
            : {}),
          ...(members.length > 1 ? { madeById } : {}),
        })
      } else {
        if (!categoryId) return
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

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape" && view === "picker") {
      e.preventDefault()
      setView("form")
      return
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      void handleSubmit()
    }
  }

  const shellClass = cn(SHELL_BASE, isMobile ? SHELL_MOBILE : SHELL_DESKTOP)

  if (view === "picker") {
    return (
      <div
        className={cn(shellClass, "gap-3")}
        role="dialog"
        aria-label="Select category"
        onKeyDown={handleKeyDown}
      >
        <TransactionCategoryPicker
          categories={typedCategories}
          selectedId={categoryId}
          recentIds={recentCategoryIds}
          onSelect={(id) => {
            setCategoryId(id)
            setView("form")
          }}
          onClose={() => setView("form")}
          onCreateCategory={onCreateCategory}
          variant={variant}
        />
      </div>
    )
  }

  return (
    <form
      ref={formRef}
      className={shellClass}
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-center justify-between gap-2">
        <Badge
          size="xs"
          className="border-0"
          style={{ color: palette.ink, background: palette.inkBg }}
        >
          <span
            className="size-1.5 rounded-full"
            style={{ background: palette.ink }}
          />
          {isEdit ? "Edit" : "New"} {activeType}
        </Badge>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => onOpenChange(false)}
          aria-label="Close"
          className={ICON_BTN}
        >
          <IconX size={16} />
        </Button>
      </div>

      {!isEdit && (
        <Tabs
          value={type}
          onValueChange={(v) => {
            setType(v as TransactionType)
            setCategoryId(null)
          }}
        >
          <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-[11px] border border-foreground/4 bg-foreground/4 p-[3px]">
            {(["expense", "income", "transfer"] as const).map((t) => {
              const isActive = type === t
              const tonePalette = TYPE_PALETTE[t]
              return (
                <TabsTrigger
                  key={t}
                  value={t}
                  className={cn(
                    "h-auto gap-1.5 py-2 text-[13px] text-foreground/55 hover:text-foreground/80 dark:text-foreground/55 dark:hover:text-foreground/80",
                    isMobile && "py-2.5"
                  )}
                  style={
                    isActive
                      ? {
                          color: tonePalette.ink,
                          background: tonePalette.inkBg,
                          boxShadow: `inset 0 0 0 1px ${tonePalette.inkRing}`,
                        }
                      : undefined
                  }
                >
                  {t === "expense" && <IconMinus size={14} />}
                  {t === "income" && <IconPlus size={14} />}
                  {t === "transfer" && <IconArrowsRightLeft size={14} />}
                  <span className="capitalize">{t}</span>
                </TabsTrigger>
              )
            })}
          </TabsList>
        </Tabs>
      )}

      <div
        className={cn(
          "border-b border-dashed border-foreground/[0.07] px-1",
          isMobile ? "pt-[14px] pb-2.5" : "pt-[18px] pb-[14px]"
        )}
      >
        <div className="flex items-baseline justify-center gap-1.5">
          <span
            className="text-[34px] leading-none font-light tabular-nums"
            style={{ color: palette.ink }}
          >
            {activeType === "expense"
              ? "−"
              : activeType === "income"
                ? "+"
                : "↔"}
          </span>
          <input
            ref={amountRef}
            type="text"
            inputMode="decimal"
            autoFocus
            value={amount}
            placeholder="0.00"
            onChange={(e) => {
              const v = e.target.value.replace(",", ".")
              if (v === "" || /^\d*\.?\d*$/.test(v)) setAmount(v)
            }}
            aria-label="Amount"
            className={cn(
              "[field-sizing:content] max-w-[calc(100%-80px)] min-w-[2.5ch] border-0 bg-transparent p-0 text-left [font-family:Geist,Inter,system-ui] leading-none font-semibold tracking-[-0.03em] text-foreground tabular-nums caret-orange-500 outline-none placeholder:text-foreground/[0.28]",
              isMobile ? "text-[46px]" : "text-[52px]"
            )}
          />
          <span className="self-end pb-2 text-[14px] font-medium tracking-[0.04em] text-foreground/40">
            {currency}
          </span>
        </div>
      </div>

      {activeType !== "transfer" ? (
        <TransactionAccountChips
          accounts={sortedAccounts}
          selectedId={accountId}
          onSelect={setAccountId}
          label={activeType === "income" ? "Into account" : "From account"}
        />
      ) : (
        <div className="flex flex-col">
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-1.5">
            <div className="min-w-0">
              <div className={SECTION_LABEL}>From</div>
              <div className="relative block">
                {fromAccount && (
                  <TransactionAccountBlock account={fromAccount} />
                )}
                <select
                  className="absolute inset-0 cursor-pointer border-0 bg-transparent [font-family:inherit] opacity-0"
                  value={fromAccountId}
                  onChange={(e) => setFromAccountId(e.target.value)}
                  aria-label="From account"
                >
                  {sortedAccounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} — {a.balance.toFixed(2)} {a.currency}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid h-[54px] place-items-center text-violet-600 dark:text-violet-300">
              <IconArrowRight size={18} />
            </div>
            <div className="min-w-0">
              <div className={SECTION_LABEL}>To</div>
              <div className="relative block">
                {toAccount ? (
                  <TransactionAccountBlock account={toAccount} />
                ) : (
                  <button
                    type="button"
                    className="flex w-full max-w-none cursor-pointer items-center gap-2 rounded-[11px] border border-violet-500/40 bg-foreground/[0.025] px-[11px] py-[9px] text-left transition-colors hover:bg-foreground/[0.05] dark:border-violet-300/35"
                  >
                    <span className="size-2 shrink-0 rounded-full bg-muted-foreground/40" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12.5px] font-medium text-foreground">
                        Pick account
                      </div>
                      <div className="truncate text-[11px] text-foreground/45 tabular-nums">
                        —
                      </div>
                    </div>
                  </button>
                )}
                <select
                  className="absolute inset-0 cursor-pointer border-0 bg-transparent [font-family:inherit] opacity-0"
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                  aria-label="To account"
                >
                  <option value="">Pick account</option>
                  {sortedAccounts
                    .filter((a) => a.id !== fromAccountId)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} — {a.balance.toFixed(2)} {a.currency}
                      </option>
                    ))}
                </select>
              </div>
            </div>
          </div>
          {showTransferExchangeRate && fromAccount && toAccount && (
            <div className="mt-2.5 flex items-center gap-2.5 rounded-[10px] border border-violet-500/25 bg-violet-500/[0.08] px-3 py-2 text-[12px] dark:border-violet-300/[0.18] dark:bg-violet-300/[0.06]">
              <span className="font-semibold text-violet-600 dark:text-violet-300/90">
                Rate
              </span>
              <span className="text-foreground/75 tabular-nums">
                1 {fromAccount.currency} =
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={transferExchangeRate}
                onChange={(e) => {
                  const v = e.target.value.replace(",", ".")
                  if (v === "" || /^\d*\.?\d*$/.test(v))
                    setTransferExchangeRate(v)
                }}
                aria-label="Exchange rate"
                className="w-[7em] border-0 bg-transparent p-0 [font-family:inherit] text-base text-foreground tabular-nums outline-none md:text-[12px]"
              />
              <span className="text-foreground/75 tabular-nums">
                {toAccount.currency}
              </span>
              <span className="ml-auto text-foreground/60 tabular-nums">
                → receive{" "}
                <strong className="font-semibold text-foreground">
                  {receiveAmount
                    ? parseFloat(receiveAmount).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })
                    : "0.00"}{" "}
                  {toAccount.currency}
                </strong>
              </span>
            </div>
          )}
        </div>
      )}

      {members.length > 1 && (
        <div className="flex flex-col">
          <div className={SECTION_LABEL}>Made by</div>
          <Select value={madeById} onValueChange={setMadeById}>
            <SelectTrigger
              size="default"
              className="h-auto rounded-[10px] border-foreground/[0.05] bg-foreground/[0.025] px-[11px] py-2 text-[12.5px] text-foreground hover:bg-foreground/[0.05] dark:bg-foreground/[0.025] dark:hover:bg-foreground/[0.05]"
            >
              <SelectValue placeholder="Select member" />
            </SelectTrigger>
            <SelectContent>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {activeType !== "transfer" && (
        <TransactionCategoryGrid
          categories={typedCategories}
          usage={categoryUsage}
          selectedId={categoryId}
          onSelect={setCategoryId}
          onMore={() => setView("picker")}
          onClearSelection={() => setCategoryId(null)}
          variant={variant}
        />
      )}

      <div className="flex flex-col">
        <div className={SECTION_LABEL}>Date</div>
        <div className="flex gap-1.5">
          {(["today", "yesterday"] as const).map((preset) => {
            const isActive = datePreset === preset
            const label = preset === "today" ? "Today" : "Yesterday"
            const setter = preset === "today" ? todayIso : yesterdayIso
            return (
              <Badge
                key={preset}
                size="lg"
                variant="outline"
                asChild
                className={cn(
                  "cursor-pointer border-foreground/[0.06] bg-foreground/[0.03] font-medium text-foreground/75 transition-colors hover:bg-foreground/[0.06] hover:text-foreground/90",
                  isActive &&
                    "border-orange-500/45 bg-orange-500/10 text-orange-600 hover:bg-orange-500/[0.16] hover:text-orange-600 dark:text-orange-400 dark:hover:text-orange-400",
                  isMobile && "px-[13px] py-2"
                )}
              >
                <button type="button" onClick={() => setDate(setter())}>
                  {label}
                </button>
              </Badge>
            )
          })}
          <Popover open={datePickerOpen} onOpenChange={setDatePickerOpen}>
            <PopoverTrigger asChild>
              <Badge
                size="lg"
                variant="outline"
                asChild
                className={cn(
                  "cursor-pointer gap-1.5 border-foreground/[0.06] bg-foreground/[0.03] font-medium text-foreground/75 transition-colors hover:bg-foreground/[0.06] hover:text-foreground/90",
                  datePreset === "custom" &&
                    "border-orange-500/45 bg-orange-500/10 text-orange-600 hover:bg-orange-500/[0.16] hover:text-orange-600 dark:text-orange-400 dark:hover:text-orange-400",
                  isMobile && "px-[13px] py-2"
                )}
              >
                <button type="button" aria-label="Pick date">
                  <IconCalendar size={13} />
                  {formatDDMM(date)}
                </button>
              </Badge>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-0">
              <Calendar
                mode="single"
                selected={parseLocalDate(date)}
                onSelect={(d) => {
                  if (!d) return
                  setDate(toLocalIso(d))
                  setDatePickerOpen(false)
                }}
                autoFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <InputGroup
        className={cn(
          "h-auto items-center rounded-[11px] border-foreground/[0.05] bg-foreground/[0.025] px-3 py-2.5",
          isMobile && "px-3 py-3"
        )}
      >
        <InputGroupAddon align="inline-start" className="text-foreground/35">
          <IconNote size={14} />
        </InputGroupAddon>
        <InputGroupInput
          type="text"
          placeholder="Add a note…"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          aria-label="Note"
          className="text-base text-foreground placeholder:text-foreground/35 md:text-[13px]"
        />
        {activeType !== "transfer" && (
          <InputGroupAddon align="inline-end">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  onClick={() => setUnsettled(!unsettled)}
                  aria-pressed={unsettled}
                  aria-label={unsettled ? "Mark settled" : "Mark unsettled"}
                  className={cn(
                    unsettled &&
                      "border-amber-400/50 bg-amber-400/[0.12] text-amber-400 hover:border-amber-400/50 hover:bg-amber-400/[0.16] hover:text-amber-400 dark:border-amber-400/50 dark:bg-amber-400/[0.12] dark:hover:bg-amber-400/[0.16]"
                  )}
                >
                  <IconAlertTriangle />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6}>
                {unsettled ? "Mark settled" : "Mark unsettled"}
              </TooltipContent>
            </Tooltip>
          </InputGroupAddon>
        )}
      </InputGroup>

      {error && (
        <p className="-mt-1 text-right text-[12px] text-destructive">{error}</p>
      )}

      <div className={cn("flex items-center gap-2 pt-1.5", isMobile && "pt-2")}>
        {isEdit && onDelete && (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onDelete}
            disabled={loading}
            className="mr-auto h-auto rounded-[10px] border border-destructive/35 bg-transparent px-[14px] py-[10px] text-[13px] text-destructive hover:bg-destructive/10"
          >
            Delete
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onOpenChange(false)}
          disabled={loading}
          className={cn(
            "h-auto rounded-[10px] border-foreground/10 bg-transparent px-[18px] py-[10px] text-[13px] text-foreground/70 hover:bg-foreground/[0.04] hover:text-foreground",
            !isEdit && "ml-auto",
            isMobile && "shrink-0"
          )}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={submitDisabled}
          className={cn(
            "h-auto rounded-[10px] border-0 px-[20px] py-[10px] text-[13px] font-semibold hover:brightness-110",
            isMobile && "flex-1"
          )}
          style={{
            background: palette.solidSubmit,
            color: palette.submitFg,
          }}
        >
          {loading
            ? "Saving…"
            : isEdit
              ? "Save changes"
              : `Create ${activeType}`}
        </Button>
      </div>
    </form>
  )
}
