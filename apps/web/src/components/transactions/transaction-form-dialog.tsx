import { useMemo, useState } from "react"
import {
  IconAlertTriangle,
  IconArrowRight,
  IconArrowsRightLeft,
  IconCalendar,
  IconMinus,
  IconNote,
  IconPlus,
} from "@tabler/icons-react"
import { useForm, useStore } from "@tanstack/react-form"
import { Amount } from "@workspace/ui/components/amount"
import { Badge } from "@workspace/ui/components/badge"
import { useLocale } from "@workspace/ui/components/locale-provider"
import { formatMoney } from "@workspace/ui/lib/money"
import { Button } from "@workspace/ui/components/button"
import { Calendar } from "@workspace/ui/components/calendar"
import {
  FORM_CANCEL_BUTTON,
  FORM_FIELD_LABEL,
  FORM_SUBMIT_BUTTON,
  FormDialog,
  FormDialogFooter,
  FormDialogHeader,
} from "@workspace/ui/components/form-dialog"
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
  Wallet,
} from "@workspace/api-contract"
import { pickableCategories } from "@/lib/categories"
import { parseLocalDate, toLocalIso } from "@/lib/dates"

type TransactionType = "expense" | "income" | "transfer"
type View = "form" | "picker"

interface TransactionFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction?: Transaction | null
  defaultType?: TransactionType
  accounts: Array<Account>
  wallets?: Array<Wallet>
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
  return toLocalIso(new Date())
}
function yesterdayIso(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return toLocalIso(d)
}

const LAST_DATE_KEY = "penny-duck:transaction-last-date"

function readLastDate(): string | null {
  try {
    const raw = localStorage.getItem(LAST_DATE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { date?: string; savedOn?: string }
    if (parsed.savedOn !== todayIso() || !parsed.date) return null
    return parseLocalDate(parsed.date) ? parsed.date : null
  } catch {
    return null
  }
}

function saveLastDate(date: string) {
  try {
    localStorage.setItem(
      LAST_DATE_KEY,
      JSON.stringify({ date, savedOn: todayIso() })
    )
  } catch {}
}
function formatDDMM(iso: string): string {
  const parts = iso.split("-")
  if (parts.length !== 3) return iso
  return `${parts[2]}.${parts[1]}`
}

// Section labels in this file get a bottom margin the shared field label does
// not — they head a group rather than label a single input.
const SECTION_LABEL = cn(FORM_FIELD_LABEL, "mb-2")

interface FormValues {
  type: TransactionType
  amount: string
  accountId: string
  categoryId: string | null
  fromAccountId: string
  toAccountId: string
  exchangeRate: string
  receiveAmount: string
  date: string
  note: string
  unsettled: boolean
  madeById: string
}

function isValid(v: FormValues): boolean {
  if (!v.amount || parseFloat(v.amount) <= 0) return false
  if (v.type === "transfer") {
    return (
      !!v.fromAccountId && !!v.toAccountId && v.fromAccountId !== v.toAccountId
    )
  }
  return !!v.accountId && !!v.categoryId
}

export function TransactionFormDialog(props: TransactionFormDialogProps) {
  const title = props.transaction ? "Edit transaction" : "New transaction"

  return (
    <FormDialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={title}
    >
      {(ctx) => <TransactionModalBody {...props} ctx={ctx} />}
    </FormDialog>
  )
}

interface ModalBodyProps extends TransactionFormDialogProps {
  ctx: {
    shellClass: string
    portalContainer: HTMLElement | null
    isMobile: boolean
    close: () => void
  }
}

function TransactionModalBody({
  transaction,
  defaultType = "expense",
  accounts,
  wallets = [],
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
  ctx,
}: ModalBodyProps) {
  const locale = useLocale()
  const isEdit = !!transaction
  const isTransferEdit = isEdit && !!transaction.transferId
  const { shellClass, isMobile, close } = ctx
  const variant: "desktop" | "mobile" = isMobile ? "mobile" : "desktop"

  const [initialValues] = useState<FormValues>(() => ({
    type: isTransferEdit
      ? "transfer"
      : transaction
        ? transaction.type
        : defaultType,
    amount: transaction ? transaction.amount.toString() : "",
    accountId:
      transaction?.accountId ?? defaultAccountId ?? accounts[0]?.id ?? "",
    categoryId: transaction?.categoryId ?? null,
    fromAccountId:
      transaction?.accountId ?? defaultAccountId ?? accounts[0]?.id ?? "",
    toAccountId: pairedAccountId ?? "",
    exchangeRate: transaction?.exchangeRate?.toString() ?? "",
    receiveAmount: transaction?.originalAmount?.toString() ?? "",
    date: transaction?.date
      ? new Date(transaction.date).toISOString().split("T")[0]
      : (readLastDate() ?? todayIso()),
    note: transaction?.note ?? "",
    unsettled: transaction ? !transaction.settled : false,
    madeById: transaction?.madeBy?.id ?? currentUserId,
  }))

  const form = useForm({
    defaultValues: initialValues,
    onSubmit: async ({ value, formApi }) => {
      if (!isValid(value)) return
      try {
        if (value.type === "transfer") {
          const fromAcc = accounts.find((a) => a.id === value.fromAccountId)
          const toAcc = accounts.find((a) => a.id === value.toAccountId)
          const diffCurrency =
            !!fromAcc && !!toAcc && fromAcc.currency !== toAcc.currency
          await onSubmitTransfer({
            fromAccountId: value.fromAccountId,
            toAccountId: value.toAccountId,
            amount: parseFloat(value.amount),
            date: new Date(value.date).toISOString(),
            ...(value.note ? { note: value.note } : {}),
            ...(diffCurrency &&
            value.exchangeRate &&
            value.receiveAmount &&
            toAcc
              ? {
                  exchangeRate: parseFloat(value.exchangeRate),
                  originalAmount: parseFloat(value.receiveAmount),
                  originalCurrency: toAcc.currency,
                }
              : {}),
            // Backend defaults madeBy to the current user; only send it when
            // the household has multiple members and the picker is shown.
            ...(members.length > 1 ? { madeById: value.madeById } : {}),
          })
        } else {
          if (!value.categoryId) return
          await onSubmitTransaction({
            accountId: value.accountId,
            type: value.type,
            amount: parseFloat(value.amount),
            categoryId: value.categoryId,
            date: new Date(value.date).toISOString(),
            ...(value.note ? { note: value.note } : {}),
            settled: !value.unsettled,
            ...(members.length > 1 ? { madeById: value.madeById } : {}),
          })
        }
        if (!isEdit) saveLastDate(value.date)
        close()
      } catch (err) {
        formApi.setErrorMap({
          onSubmit: {
            form: err instanceof Error ? err.message : "Something went wrong",
            fields: {},
          },
        })
      }
    },
  })

  function recomputeRate() {
    const v = form.state.values
    if (v.type !== "transfer") return
    const fromAcc = accounts.find((a) => a.id === v.fromAccountId)
    const toAcc = accounts.find((a) => a.id === v.toAccountId)
    if (!fromAcc || !toAcc) return
    if (fromAcc.currency === toAcc.currency) return
    const rate = exchangeRates?.[fromAcc.currency]?.[toAcc.currency]
    if (rate !== undefined) {
      form.setFieldValue("exchangeRate", rate.toFixed(6))
    }
  }

  function recomputeReceive() {
    const v = form.state.values
    if (v.type !== "transfer") return
    if (!v.amount || !v.exchangeRate) return
    const calc = parseFloat(v.amount) * parseFloat(v.exchangeRate)
    if (!isNaN(calc)) {
      form.setFieldValue("receiveAmount", calc.toFixed(2))
    }
  }

  const [view, setView] = useState<View>("form")
  const [datePickerOpen, setDatePickerOpen] = useState(false)

  const values = useStore(form.store, (s) => s.values)
  const isSubmitting = useStore(form.store, (s) => s.isSubmitting)
  const submitErrorRaw = useStore(form.store, (s) => s.errorMap.onSubmit)

  const activeType: TransactionType = values.type

  const typedCategories =
    activeType === "transfer"
      ? []
      : pickableCategories(categories, values.categoryId).filter(
          (c) => c.type === activeType
        )

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

  const fromAccount = accounts.find((a) => a.id === values.fromAccountId)
  const toAccount = accounts.find((a) => a.id === values.toAccountId)
  const currenciesDiffer =
    !!fromAccount && !!toAccount && fromAccount.currency !== toAccount.currency
  const showTransferExchangeRate = currenciesDiffer

  const isConvert =
    values.type === "transfer" &&
    !!fromAccount?.walletId &&
    fromAccount.walletId === toAccount?.walletId

  const palette = TYPE_PALETTE[activeType]
  const currency =
    activeType === "transfer"
      ? (fromAccount?.currency ?? "UAH")
      : (accounts.find((a) => a.id === values.accountId)?.currency ?? "UAH")

  const datePreset: "today" | "yesterday" | "custom" =
    values.date === todayIso()
      ? "today"
      : values.date === yesterdayIso()
        ? "yesterday"
        : "custom"

  const submitDisabled = isSubmitting || !isValid(values)

  const submitErrorText =
    typeof submitErrorRaw === "string"
      ? submitErrorRaw
      : submitErrorRaw &&
          typeof submitErrorRaw === "object" &&
          "form" in submitErrorRaw
        ? (submitErrorRaw as { form?: string }).form
        : undefined

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape" && view === "picker") {
      e.preventDefault()
      setView("form")
      return
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      void form.handleSubmit()
    }
  }

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
          selectedId={values.categoryId}
          recentIds={recentCategoryIds}
          onSelect={(id) => {
            form.setFieldValue("categoryId", id)
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
      className={shellClass}
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        void form.handleSubmit()
      }}
      onKeyDown={handleKeyDown}
    >
      <FormDialogHeader onClose={close}>
        <Badge
          size="xs"
          className="border-0"
          style={{ color: palette.ink, background: palette.inkBg }}
        >
          <span
            className="size-1.5 rounded-full"
            style={{ background: palette.ink }}
          />
          {isEdit ? "Edit" : "New"} {isConvert ? "conversion" : activeType}
        </Badge>
      </FormDialogHeader>

      {!isEdit && (
        <Tabs
          value={values.type}
          onValueChange={(v) => {
            form.setFieldValue("type", v as TransactionType)
            // Categories are typed (expense vs income), so any previous
            // selection is invalid after a type change.
            form.setFieldValue("categoryId", null)
          }}
        >
          <TabsList className="grid h-auto w-full grid-cols-3 gap-1 rounded-[11px] border border-foreground/4 bg-foreground/4 p-0.75">
            {(["expense", "income", "transfer"] as const).map((t) => {
              const isActive = values.type === t
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
          isMobile ? "pt-3.5 pb-2.5" : "pt-4.5 pb-3.5"
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
          <form.Field name="amount" listeners={{ onChange: recomputeReceive }}>
            {(field) => (
              <input
                type="text"
                inputMode="decimal"
                autoFocus
                value={field.state.value}
                placeholder="0.00"
                onChange={(e) => {
                  const v = e.target.value.replace(",", ".")
                  if (v === "" || /^\d{0,12}(\.\d{0,2})?$/.test(v))
                    field.handleChange(v)
                }}
                aria-label="Amount"
                className={cn(
                  "field-sizing-content max-w-[calc(100%-80px)] min-w-[2.5ch] border-0 bg-transparent p-0 text-left font-[Geist,Inter,system-ui] leading-none font-semibold tracking-[-0.03em] text-foreground tabular-nums caret-primary outline-none placeholder:text-foreground/[0.28]",
                  isMobile ? "text-[46px]" : "text-[52px]"
                )}
              />
            )}
          </form.Field>
          <span className="self-end pb-2 text-[14px] font-medium tracking-[0.04em] text-foreground/40">
            {currency}
          </span>
        </div>
      </div>

      {activeType !== "transfer" ? (
        <TransactionAccountChips
          accounts={sortedAccounts}
          wallets={wallets}
          selectedId={values.accountId}
          onSelect={(id) => form.setFieldValue("accountId", id)}
          label={activeType === "income" ? "Into account" : "From account"}
          accountUsage={accountUsage}
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
                <form.Field
                  name="fromAccountId"
                  listeners={!isEdit ? { onChange: recomputeRate } : undefined}
                >
                  {(field) => (
                    <select
                      className="absolute inset-0 cursor-pointer border-0 bg-transparent font-[inherit] opacity-0"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-label="From account"
                    >
                      {wallets
                        .filter((w) =>
                          sortedAccounts.some((a) => a.walletId === w.id)
                        )
                        .map((w) => (
                          <optgroup key={w.id} label={w.name}>
                            {sortedAccounts
                              .filter((a) => a.walletId === w.id)
                              .map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.currency} —{" "}
                                  {formatMoney(a.balance, { locale })}
                                </option>
                              ))}
                          </optgroup>
                        ))}
                      {sortedAccounts
                        .filter((a) => a.walletId === null)
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} —{" "}
                            {formatMoney(a.balance, {
                              locale,
                              currency: a.currency,
                            })}
                          </option>
                        ))}
                    </select>
                  )}
                </form.Field>
              </div>
            </div>
            <div className="grid h-13.5 place-items-center text-violet-600 dark:text-violet-300">
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
                    className="flex w-full max-w-none cursor-pointer items-center gap-2 rounded-[11px] border border-violet-500/40 bg-card px-2.75 py-2.25 text-left transition-colors hover:bg-card/80 dark:border-violet-300/35"
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
                <form.Field
                  name="toAccountId"
                  listeners={!isEdit ? { onChange: recomputeRate } : undefined}
                >
                  {(field) => (
                    <select
                      className="absolute inset-0 cursor-pointer border-0 bg-transparent font-[inherit] opacity-0"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      aria-label="To account"
                    >
                      <option value="">Pick account</option>
                      {wallets
                        .filter((w) =>
                          sortedAccounts.some(
                            (a) =>
                              a.walletId === w.id &&
                              a.id !== values.fromAccountId
                          )
                        )
                        .map((w) => (
                          <optgroup key={w.id} label={w.name}>
                            {sortedAccounts
                              .filter(
                                (a) =>
                                  a.walletId === w.id &&
                                  a.id !== values.fromAccountId
                              )
                              .map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.currency} —{" "}
                                  {formatMoney(a.balance, { locale })}
                                </option>
                              ))}
                          </optgroup>
                        ))}
                      {sortedAccounts
                        .filter(
                          (a) =>
                            a.walletId === null && a.id !== values.fromAccountId
                        )
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} —{" "}
                            {formatMoney(a.balance, {
                              locale,
                              currency: a.currency,
                            })}
                          </option>
                        ))}
                    </select>
                  )}
                </form.Field>
              </div>
            </div>
          </div>
          {showTransferExchangeRate && fromAccount && toAccount && (
            <div className="mt-2.5 flex items-center gap-2.5 rounded-[10px] border border-violet-500/25 bg-violet-500/8 px-3 py-2 text-[12px] dark:border-violet-300/18 dark:bg-violet-300/6">
              <span className="font-semibold text-violet-600 dark:text-violet-300/90">
                Rate
              </span>
              <span className="text-foreground/75 tabular-nums">
                1 {fromAccount.currency} =
              </span>
              <form.Field
                name="exchangeRate"
                listeners={{ onChange: recomputeReceive }}
              >
                {(field) => (
                  <input
                    type="text"
                    inputMode="decimal"
                    value={field.state.value}
                    onChange={(e) => {
                      const v = e.target.value.replace(",", ".")
                      if (v === "" || /^\d{0,8}(\.\d{0,6})?$/.test(v))
                        field.handleChange(v)
                    }}
                    aria-label="Exchange rate"
                    className="w-[7em] border-0 bg-transparent p-0 font-[inherit] text-base text-foreground tabular-nums outline-none md:text-[12px]"
                  />
                )}
              </form.Field>
              <span className="text-foreground/75 tabular-nums">
                {toAccount.currency}
              </span>
              <span className="ml-auto text-foreground/60 tabular-nums">
                → receive{" "}
                <Amount
                  value={parseFloat(values.receiveAmount) || 0}
                  currency={toAccount.currency}
                  className="font-semibold text-foreground"
                />
              </span>
            </div>
          )}
        </div>
      )}

      {members.length > 1 && (
        <div className="flex flex-col">
          <div className={SECTION_LABEL}>Made by</div>
          <Select
            value={values.madeById}
            onValueChange={(v) => form.setFieldValue("madeById", v)}
          >
            <SelectTrigger
              size="default"
              className="h-auto rounded-[10px] border-foreground/5 bg-card px-2.75 py-2 text-[12.5px] text-foreground hover:bg-card/80"
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
          selectedId={values.categoryId}
          onSelect={(id) => form.setFieldValue("categoryId", id)}
          onMore={() => setView("picker")}
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
                selected={isActive}
                asChild
                className={cn(isMobile && "px-3.25 py-2")}
              >
                <button
                  type="button"
                  onClick={() => form.setFieldValue("date", setter())}
                >
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
                selected={datePreset === "custom"}
                asChild
                className={cn("gap-1.5", isMobile && "px-3.25 py-2")}
              >
                <button type="button" aria-label="Pick date">
                  <IconCalendar size={13} />
                  {formatDDMM(values.date)}
                </button>
              </Badge>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-0">
              <Calendar
                mode="single"
                selected={parseLocalDate(values.date)}
                onSelect={(d) => {
                  if (!d) return
                  form.setFieldValue("date", toLocalIso(d))
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
          "h-auto items-center rounded-[11px] border-foreground/5 bg-card px-3 py-2.5",
          isMobile && "p-3"
        )}
      >
        <InputGroupAddon align="inline-start" className="text-foreground/35">
          <IconNote size={14} />
        </InputGroupAddon>
        <InputGroupInput
          type="text"
          placeholder="Add a note…"
          value={values.note}
          onChange={(e) => form.setFieldValue("note", e.target.value)}
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
                  onClick={() =>
                    form.setFieldValue("unsettled", !values.unsettled)
                  }
                  aria-pressed={values.unsettled}
                  aria-label={
                    values.unsettled ? "Mark settled" : "Mark unsettled"
                  }
                  className={cn(
                    values.unsettled &&
                      "border-warning/50 bg-warning/12 text-warning hover:border-warning/50 hover:bg-warning/16 hover:text-warning dark:border-warning/50 dark:bg-warning/12 dark:hover:bg-warning/16"
                  )}
                >
                  <IconAlertTriangle />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" sideOffset={6}>
                {values.unsettled ? "Mark settled" : "Mark unsettled"}
              </TooltipContent>
            </Tooltip>
          </InputGroupAddon>
        )}
      </InputGroup>

      <FormDialogFooter isMobile={isMobile} error={submitErrorText}>
        {isEdit && onDelete && (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={onDelete}
            disabled={isSubmitting}
            className="mr-auto h-auto rounded-[10px] border border-destructive/35 bg-transparent px-3.5 py-2.5 text-[13px] text-destructive hover:bg-destructive/10"
          >
            Delete
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={close}
          disabled={isSubmitting}
          className={cn(
            FORM_CANCEL_BUTTON,
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
            FORM_SUBMIT_BUTTON,
            "border-0 hover:brightness-110",
            isMobile && "flex-1"
          )}
          style={{
            background: palette.solidSubmit,
            color: palette.submitFg,
          }}
        >
          {isSubmitting
            ? "Saving…"
            : isEdit
              ? "Save changes"
              : `Create ${activeType}`}
        </Button>
      </FormDialogFooter>
    </form>
  )
}
