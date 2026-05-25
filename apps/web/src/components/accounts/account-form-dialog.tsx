import { useState } from "react"
import {
  IconAlertTriangle,
  IconCreditCard,
  IconMinus,
  IconPlus,
  IconTrendingUp,
  IconWallet,
} from "@tabler/icons-react"
import { useForm } from "@tanstack/react-form"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@workspace/ui/components/field"
import {
  FORM_CANCEL_BUTTON,
  FORM_FIELD_LABEL,
  FORM_SUBMIT_BUTTON,
  FORM_TRIGGER_ROW,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@workspace/ui/components/select"
import { Switch } from "@workspace/ui/components/switch"
import { cn } from "@workspace/ui/lib/utils"
import { toast } from "sonner"
import * as z from "zod"
import type { AccountData } from "@/components/accounts/account-card"
import type { Wallet } from "@workspace/api-contract"
import type { PaletteColor } from "@/lib/palette"
import { ColorPicker } from "@/components/color-picker"
import { CurrencyPicker } from "@/components/currency-picker"
import { IconPicker } from "@/components/icon-picker"
import { ICON_TOKENS, getIcon, pickRandomUnusedIcon } from "@/lib/icons"
import {
  PALETTE_TOKENS,
  paletteColor,
  pickRandomUnusedColor,
} from "@/lib/palette"

function asPaletteColor(s: string | null | undefined): PaletteColor | null {
  return s != null && (PALETTE_TOKENS as ReadonlyArray<string>).includes(s)
    ? (s as PaletteColor)
    : null
}

function asKnownIcon(s: string | null | undefined): string | null {
  return s != null && ICON_TOKENS.includes(s) ? s : null
}

// API errors are thrown as the parsed JSON body ({ message }), not Error
// instances, so read the message off the object when present.
function messageOf(err: unknown, fallback: string): string {
  if (
    err &&
    typeof err === "object" &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string"
  ) {
    return (err as { message: string }).message
  }
  return fallback
}

type AccountType = "bank" | "wallet" | "brokerage"

const ACCOUNT_TYPES: Array<{
  id: AccountType
  name: string
  desc: string
  Icon: typeof IconCreditCard
}> = [
  {
    id: "bank",
    name: "Bank",
    desc: "Checking, savings, or card account",
    Icon: IconCreditCard,
  },
  {
    id: "wallet",
    name: "Wallet",
    desc: "Physical cash — supports multiple currencies",
    Icon: IconWallet,
  },
  {
    id: "brokerage",
    name: "Brokerage",
    desc: "Stocks, ETFs, and other investments",
    Icon: IconTrendingUp,
  },
]

interface PocketFormRow {
  id: string
  currency: string
  balance: string
}

function newPocketRow(): PocketFormRow {
  return { id: crypto.randomUUID(), currency: "", balance: "" }
}

interface FormValues {
  name: string
  type: AccountType
  currency: string
  balance: string
  isDefault: boolean
  color: string
  icon: string
}

const baseSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "100 characters or fewer"),
  type: z.enum(["bank", "wallet", "brokerage"]),
  balance: z.string(),
  isDefault: z.boolean(),
  color: z.string().trim().min(1, "Pick a color").max(20),
  icon: z.string().trim().min(1, "Pick an icon").max(50),
})

const createFormSchema = baseSchema
  .extend({
    currency: z.string(),
  })
  .refine((data) => data.type === "wallet" || data.currency.length === 3, {
    message: "Select a currency",
    path: ["currency"],
  })

const editFormSchema = baseSchema.extend({
  currency: z.string(),
})

export interface AccountSubmitData {
  id: string | null
  name: string
  type: string
  currency: string
  color: string
  icon: string
  balance: number
  isDefault: boolean
}

export interface WalletSubmitData {
  id: string | null
  name: string
  color: string
  icon: string
  pockets: Array<{ currency: string; balance: number }>
}

interface AccountFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account?: AccountData | null
  wallet?: Wallet | null
  initialType?: AccountType
  existingAccountColors?: ReadonlyArray<string | null>
  existingAccountIcons?: ReadonlyArray<string | null>
  onSubmit: (data: AccountSubmitData) => Promise<void>
  onSubmitWallet: (data: WalletSubmitData) => Promise<void>
  onArchive?: (account: AccountData) => void
  onDeleteWallet?: (wallet: Wallet) => Promise<void>
  onAddPocket?: (walletId: string, currency: string, balance: number) => Promise<void>
  onDeletePocket?: (walletId: string, currency: string) => Promise<void>
  pocketTransactionCounts?: Record<string, number>
}

export function AccountFormDialog(props: AccountFormDialogProps) {
  const isWalletEdit = !!props.wallet
  const title = isWalletEdit
    ? "Edit wallet"
    : props.account
      ? "Edit account"
      : "New account"

  return (
    <FormDialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={title}
    >
      {(ctx) => <AccountModalBody {...props} ctx={ctx} />}
    </FormDialog>
  )
}

interface ModalBodyProps extends AccountFormDialogProps {
  ctx: {
    shellClass: string
    portalContainer: HTMLElement | null
    isMobile: boolean
    close: () => void
  }
}

function AccountModalBody({
  account,
  wallet,
  initialType,
  existingAccountColors,
  existingAccountIcons,
  onSubmit: onSubmitProp,
  onSubmitWallet: onSubmitWalletProp,
  onArchive,
  onDeleteWallet,
  onAddPocket,
  onDeletePocket,
  pocketTransactionCounts,
  ctx,
}: ModalBodyProps) {
  const isEdit = !!account
  const isWalletEdit = !!wallet
  const { shellClass, portalContainer, isMobile, close } = ctx

  // Wallet edit mode is handled separately
  if (isWalletEdit && wallet) {
    return (
      <WalletEditBody
        wallet={wallet}
        existingAccountColors={existingAccountColors}
        existingAccountIcons={existingAccountIcons}
        onSubmitWallet={onSubmitWalletProp}
        onDeleteWallet={onDeleteWallet}
        onAddPocket={onAddPocket}
        onDeletePocket={onDeletePocket}
        pocketTransactionCounts={pocketTransactionCounts}
        shellClass={shellClass}
        portalContainer={portalContainer}
        isMobile={isMobile}
        close={close}
      />
    )
  }

  const schema = isEdit ? editFormSchema : createFormSchema

  const [initialValues] = useState<FormValues>(() => ({
    name: account?.name ?? "",
    type: (account?.type as AccountType) ?? initialType ?? "bank",
    currency: account?.currency ?? "",
    balance: "",
    isDefault: account?.isDefault ?? false,
    color:
      asPaletteColor(account?.color) ??
      pickRandomUnusedColor(existingAccountColors ?? []),
    icon:
      asKnownIcon(account?.icon) ??
      pickRandomUnusedIcon(existingAccountIcons ?? []),
  }))

  // Wallet-specific pocket state (create mode only)
  const [pockets, setPockets] = useState<Array<PocketFormRow>>(() => [
    newPocketRow(),
  ])
  const [pocketError, setPocketError] = useState<string | null>(null)

  function addPocketRow() {
    setPockets((prev) => [...prev, newPocketRow()])
  }

  function removePocketRow(idx: number) {
    setPockets((prev) => prev.filter((_, i) => i !== idx))
  }

  function updatePocketCurrency(idx: number, currency: string) {
    setPockets((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, currency } : p))
    )
  }

  function updatePocketBalance(idx: number, balance: string) {
    setPockets((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, balance } : p))
    )
  }

  function validatePockets(): boolean {
    if (pockets.length === 0) {
      setPocketError("Add at least one currency pocket")
      return false
    }
    const currencies = pockets.map((p) => p.currency)
    const hasMissing = currencies.some((c) => c.length !== 3)
    if (hasMissing) {
      setPocketError("All pockets must have a currency selected")
      return false
    }
    const uniqueCurrencies = new Set(currencies)
    if (uniqueCurrencies.size !== currencies.length) {
      setPocketError("Each currency can only appear once")
      return false
    }
    setPocketError(null)
    return true
  }

  const form = useForm({
    defaultValues: initialValues,
    validators: {
      onChange: schema,
      onSubmit: schema,
    },
    onSubmit: async ({ value, formApi }) => {
      try {
        if (value.type === "wallet") {
          if (!validatePockets()) return
          await onSubmitWalletProp({
            id: null,
            name: value.name.trim(),
            color: value.color,
            icon: value.icon,
            pockets: pockets.map((p) => ({
              currency: p.currency,
              balance: parseFloat(p.balance) || 0,
            })),
          })
        } else {
          const balanceNum =
            !account && value.balance !== "" ? parseFloat(value.balance) : 0
          await onSubmitProp({
            id: account?.id ?? null,
            name: value.name.trim(),
            type: value.type,
            currency: value.currency,
            color: value.color,
            icon: value.icon,
            balance: balanceNum,
            isDefault: value.isDefault,
          })
        }
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

  const wasDefault = !!account?.isDefault
  const defaultSwitchDisabled = isEdit && wasDefault

  function handleArchiveClick() {
    if (!account || !onArchive) return
    close()
    onArchive(account)
  }

  return (
    <form
      className={shellClass}
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        void form.handleSubmit()
      }}
    >
      <FormDialogHeader onClose={close}>
        <Badge
          size="xs"
          variant="secondary"
          className="border-0 bg-primary/10 text-primary"
        >
          <span className="size-1.5 rounded-full bg-primary" />
          {isEdit ? "Edit account" : "New account"}
        </Badge>
      </FormDialogHeader>

      <form.Subscribe selector={(s) => s.values}>
        {(values) => (
          <PreviewCard
            name={values.name}
            type={values.type}
            currency={
              values.type === "wallet"
                ? pockets.map((p) => p.currency || "?").join(", ")
                : values.currency || account?.currency || "—"
            }
            balance={
              isEdit ? (account?.balance ?? 0) : parseFloat(values.balance) || 0
            }
            isDefault={values.isDefault}
            color={values.color}
            icon={values.icon}
            pockets={
              values.type === "wallet"
                ? pockets.map((p) => ({
                    currency: p.currency,
                    balance: parseFloat(p.balance) || 0,
                  }))
                : undefined
            }
          />
        )}
      </form.Subscribe>

      <form.Field name="name">
        {(field) => {
          const isInvalid =
            field.state.meta.isTouched && !field.state.meta.isValid
          return (
            <Field data-invalid={isInvalid}>
              <FieldLabel htmlFor={field.name} className={FORM_FIELD_LABEL}>
                Name
              </FieldLabel>
              <div
                className={cn(
                  "flex items-center gap-1.5 rounded-[11px] border border-border bg-card px-1.5 py-1.5 focus-within:border-primary/45",
                  isInvalid && "border-destructive/45"
                )}
              >
                <form.Field name="color">
                  {(colorField) => (
                    <ColorPicker
                      value={asPaletteColor(colorField.state.value)}
                      onChange={(v) => colorField.handleChange(v)}
                      portalContainer={portalContainer}
                    />
                  )}
                </form.Field>
                <form.Field name="icon">
                  {(iconField) => (
                    <IconPicker
                      value={iconField.state.value}
                      onChange={(v) => iconField.handleChange(v)}
                      portalContainer={portalContainer}
                    />
                  )}
                </form.Field>
                <input
                  id={field.name}
                  name={field.name}
                  type="text"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={isInvalid}
                  placeholder="e.g. Main Wallet"
                  className="min-w-0 flex-1 border-0 bg-transparent px-1.5 text-base text-foreground outline-none placeholder:text-muted-foreground/60 md:text-[13px]"
                />
              </div>
              {isInvalid && <FieldError errors={field.state.meta.errors} />}
            </Field>
          )
        }}
      </form.Field>

      <form.Field name="type">
        {(field) => {
          const isInvalid =
            field.state.meta.isTouched && !field.state.meta.isValid
          const selected =
            ACCOUNT_TYPES.find((t) => t.id === field.state.value) ??
            ACCOUNT_TYPES[0]
          const SelectedIcon = selected.Icon
          return (
            <Field data-invalid={isInvalid}>
              <FieldLabel htmlFor={field.name} className={FORM_FIELD_LABEL}>
                Type
              </FieldLabel>
              <Select
                name={field.name}
                value={field.state.value}
                onValueChange={(v) => field.handleChange(v as AccountType)}
                disabled={isEdit}
              >
                <SelectTrigger
                  id={field.name}
                  size="lg"
                  aria-invalid={isInvalid}
                  className={FORM_TRIGGER_ROW}
                >
                  <span className="flex flex-1 items-center gap-2.5 text-left">
                    <span className="grid size-7 shrink-0 place-items-center rounded-[8px] bg-foreground/4 text-muted-foreground">
                      <SelectedIcon size={15} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="text-[13.5px] font-medium text-foreground">
                        {selected.name}
                      </span>
                      <span className="truncate text-[11.5px] text-muted-foreground">
                        {selected.desc}
                      </span>
                    </span>
                  </span>
                </SelectTrigger>
                <SelectContent position="popper" align="start" sideOffset={6}>
                  {ACCOUNT_TYPES.map((t) => {
                    const ItemIcon = t.Icon
                    return (
                      <SelectItem
                        key={t.id}
                        value={t.id}
                        className="py-2 pr-8 pl-2"
                      >
                        <span className="flex items-center gap-2.5">
                          <span className="grid size-7 shrink-0 place-items-center rounded-[8px] bg-foreground/4 text-muted-foreground">
                            <ItemIcon size={15} />
                          </span>
                          <span className="flex flex-col gap-0.5">
                            <span className="text-[13.5px] font-medium text-foreground">
                              {t.name}
                            </span>
                            <span className="text-[11.5px] text-muted-foreground">
                              {t.desc}
                            </span>
                          </span>
                        </span>
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
              {isInvalid && <FieldError errors={field.state.meta.errors} />}
            </Field>
          )
        }}
      </form.Field>

      <form.Subscribe selector={(s) => s.values.type}>
        {(type) =>
          type === "wallet" ? (
            <PocketFields
              pockets={pockets}
              error={pocketError}
              portalContainer={portalContainer}
              onAddPocket={addPocketRow}
              onRemovePocket={removePocketRow}
              onUpdateCurrency={updatePocketCurrency}
              onUpdateBalance={updatePocketBalance}
            />
          ) : isEdit ? (
            <form.Field name="currency">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name} className={FORM_FIELD_LABEL}>
                    Currency
                  </FieldLabel>
                  <CurrencyPicker
                    id={field.name}
                    value={field.state.value}
                    onValueChange={field.handleChange}
                    disabled
                    portalContainer={portalContainer}
                  />
                </Field>
              )}
            </form.Field>
          ) : (
            <div className="grid grid-cols-[1fr_140px] gap-2.5">
              <form.Field name="currency">
                {(field) => {
                  const isInvalid =
                    field.state.meta.isTouched && !field.state.meta.isValid
                  return (
                    <Field data-invalid={isInvalid}>
                      <FieldLabel
                        htmlFor={field.name}
                        className={FORM_FIELD_LABEL}
                      >
                        Currency
                      </FieldLabel>
                      <CurrencyPicker
                        id={field.name}
                        value={field.state.value}
                        onValueChange={field.handleChange}
                        invalid={isInvalid}
                        portalContainer={portalContainer}
                      />
                      {isInvalid && (
                        <FieldError errors={field.state.meta.errors} />
                      )}
                    </Field>
                  )
                }}
              </form.Field>
              <form.Field name="balance">
                {(field) => (
                  <form.Subscribe selector={(s) => s.values.currency}>
                    {(currencyCode) => (
                      <Field>
                        <FieldLabel
                          htmlFor={field.name}
                          className={FORM_FIELD_LABEL}
                        >
                          Initial balance
                        </FieldLabel>
                        <InputGroup className="h-10 items-center rounded-[11px] border-border bg-card px-3">
                          <InputGroupInput
                            id={field.name}
                            name={field.name}
                            type="text"
                            inputMode="decimal"
                            placeholder="0.00"
                            value={field.state.value}
                            onChange={(e) => {
                              const value = e.target.value.replace(",", ".")
                              if (
                                value === "" ||
                                /^\d{0,12}(\.\d{0,2})?$/.test(value)
                              )
                                field.handleChange(value)
                            }}
                            className="text-right text-base tabular-nums"
                          />
                          <InputGroupAddon
                            align="inline-end"
                            className="text-[11px] font-semibold tracking-[0.04em] text-muted-foreground"
                          >
                            {currencyCode || "—"}
                          </InputGroupAddon>
                        </InputGroup>
                      </Field>
                    )}
                  </form.Subscribe>
                )}
              </form.Field>
            </div>
          )
        }
      </form.Subscribe>

      <form.Subscribe selector={(s) => s.values.type}>
        {(type) =>
          type !== "wallet" ? (
            <form.Field name="isDefault">
              {(field) => (
                <Field
                  orientation="horizontal"
                  className={cn(
                    "rounded-[11px] border border-border bg-foreground/2 p-3 transition-colors",
                    field.state.value &&
                      !defaultSwitchDisabled &&
                      "border-primary/30 bg-primary/4",
                    defaultSwitchDisabled && "opacity-70"
                  )}
                >
                  <Switch
                    id={field.name}
                    name={field.name}
                    checked={field.state.value}
                    onCheckedChange={(v) => field.handleChange(v)}
                    disabled={defaultSwitchDisabled}
                  />
                  <FieldContent>
                    <FieldLabel
                      htmlFor={field.name}
                      className={cn(
                        "text-[13px] font-medium text-foreground",
                        !defaultSwitchDisabled && "cursor-pointer",
                        defaultSwitchDisabled && "cursor-not-allowed"
                      )}
                    >
                      Make this my default account
                    </FieldLabel>
                    <FieldDescription className="text-[11.5px]">
                      {defaultSwitchDisabled
                        ? "Already your default — pick a different account to change."
                        : "New transactions will use it unless you pick another."}
                    </FieldDescription>
                  </FieldContent>
                </Field>
              )}
            </form.Field>
          ) : null
        }
      </form.Subscribe>

      {isEdit && onArchive && account && (
        <div className="flex items-center gap-3 rounded-[11px] border border-destructive/25 bg-destructive/5 p-3">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[13px] font-medium text-destructive">
              Archive this account
            </span>
            <span className="text-[11.5px] text-muted-foreground">
              Hides it from totals and the picker. Transactions are kept.
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleArchiveClick}
            className="shrink-0 border-destructive/35 bg-transparent text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <IconAlertTriangle size={13} />
            Archive
          </Button>
        </div>
      )}

      <form.Subscribe
        selector={(s) => [s.canSubmit, s.isSubmitting, s.errorMap] as const}
      >
        {([canSubmit, isSubmitting, errorMap]) => {
          const submitError = errorMap.onSubmit
          const errorText =
            typeof submitError === "string"
              ? submitError
              : submitError &&
                  typeof submitError === "object" &&
                  "form" in submitError
                ? (submitError as { form?: string }).form
                : undefined
          return (
            <FormDialogFooter isMobile={isMobile} error={errorText}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={close}
                disabled={isSubmitting}
                className={cn(
                  FORM_CANCEL_BUTTON,
                  "ml-auto",
                  isMobile && "shrink-0"
                )}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!canSubmit || isSubmitting}
                className={cn(FORM_SUBMIT_BUTTON, isMobile && "flex-1")}
              >
                {isSubmitting
                  ? "Saving…"
                  : isEdit
                    ? "Save changes"
                    : "Create account"}
              </Button>
            </FormDialogFooter>
          )
        }}
      </form.Subscribe>
    </form>
  )
}

interface PocketFieldsProps {
  pockets: Array<PocketFormRow>
  error: string | null
  portalContainer: HTMLElement | null
  onAddPocket: () => void
  onRemovePocket: (idx: number) => void
  onUpdateCurrency: (idx: number, currency: string) => void
  onUpdateBalance: (idx: number, balance: string) => void
}

function PocketFields({
  pockets,
  error,
  portalContainer,
  onAddPocket,
  onRemovePocket,
  onUpdateCurrency,
  onUpdateBalance,
}: PocketFieldsProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className={cn(FORM_FIELD_LABEL, "text-[11.5px] font-medium text-muted-foreground uppercase tracking-wider")}>
          Currency pockets
        </span>
      </div>
      <div className="space-y-2">
        {pockets.map((pocket, idx) => (
          <div key={pocket.id} className="flex items-start gap-2">
            <div className="flex-1">
              <CurrencyPicker
                value={pocket.currency}
                onValueChange={(c) => onUpdateCurrency(idx, c)}
                portalContainer={portalContainer}
              />
            </div>
            <div className="w-[130px]">
              <InputGroup className="h-10 items-center rounded-[11px] border-border bg-card px-3">
                <InputGroupInput
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={pocket.balance}
                  onChange={(e) => {
                    const value = e.target.value.replace(",", ".")
                    if (value === "" || /^\d{0,12}(\.\d{0,2})?$/.test(value))
                      onUpdateBalance(idx, value)
                  }}
                  className="text-right text-base tabular-nums"
                />
                <InputGroupAddon
                  align="inline-end"
                  className="text-[11px] font-semibold tracking-[0.04em] text-muted-foreground"
                >
                  {pocket.currency || "—"}
                </InputGroupAddon>
              </InputGroup>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onRemovePocket(idx)}
              disabled={pockets.length <= 1}
              className="mt-0 h-10 w-10 shrink-0 text-muted-foreground hover:text-destructive disabled:opacity-30"
            >
              <IconMinus size={14} />
            </Button>
          </div>
        ))}
      </div>
      {error && (
        <p className="text-[11.5px] text-destructive">{error}</p>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onAddPocket}
        className="w-full"
      >
        <IconPlus size={13} />
        Add currency
      </Button>
    </div>
  )
}

// Wallet edit body — handles rename/recolor/reicon + add/delete pockets

interface WalletEditBodyProps {
  wallet: Wallet
  existingAccountColors?: ReadonlyArray<string | null>
  existingAccountIcons?: ReadonlyArray<string | null>
  onSubmitWallet: (data: WalletSubmitData) => Promise<void>
  onDeleteWallet?: (wallet: Wallet) => Promise<void>
  onAddPocket?: (walletId: string, currency: string, balance: number) => Promise<void>
  onDeletePocket?: (walletId: string, currency: string) => Promise<void>
  pocketTransactionCounts?: Record<string, number>
  shellClass: string
  portalContainer: HTMLElement | null
  isMobile: boolean
  close: () => void
}

const walletEditSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Name is required")
    .max(100, "100 characters or fewer"),
  color: z.string().trim().min(1, "Pick a color").max(20),
  icon: z.string().trim().min(1, "Pick an icon").max(50),
})

function WalletEditBody({
  wallet,
  existingAccountColors,
  existingAccountIcons,
  onSubmitWallet,
  onDeleteWallet,
  onAddPocket,
  onDeletePocket,
  pocketTransactionCounts,
  shellClass,
  portalContainer,
  isMobile,
  close,
}: WalletEditBodyProps) {
  const [initialValues] = useState<{ name: string; color: string; icon: string }>(() => ({
    name: wallet.name,
    color: asPaletteColor(wallet.color) ?? pickRandomUnusedColor(existingAccountColors ?? []),
    icon: asKnownIcon(wallet.icon) ?? pickRandomUnusedIcon(existingAccountIcons ?? []),
  }))

  // New pocket form state
  const [newPocket, setNewPocket] = useState<{ currency: string; balance: string } | null>(null)
  const [addPocketError, setAddPocketError] = useState<string | null>(null)
  const [deletingCurrency, setDeletingCurrency] = useState<string | null>(null)
  const [deletingWallet, setDeletingWallet] = useState(false)

  const form = useForm({
    defaultValues: initialValues,
    validators: {
      onChange: walletEditSchema,
      onSubmit: walletEditSchema,
    },
    onSubmit: async ({ value, formApi }) => {
      try {
        await onSubmitWallet({
          id: wallet.id,
          name: value.name.trim(),
          color: value.color,
          icon: value.icon,
          pockets: [],
        })
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

  async function handleAddPocket() {
    if (!newPocket || !onAddPocket) return
    if (newPocket.currency.length !== 3) {
      setAddPocketError("Select a currency")
      return
    }
    const alreadyExists = wallet.pockets.some((p) => p.currency === newPocket.currency)
    if (alreadyExists) {
      setAddPocketError("This currency already exists in the wallet")
      return
    }
    setAddPocketError(null)
    try {
      await onAddPocket(wallet.id, newPocket.currency, parseFloat(newPocket.balance) || 0)
      setNewPocket(null)
    } catch (err) {
      setAddPocketError(messageOf(err, "Failed to add pocket"))
    }
  }

  async function handleDeletePocket(currency: string) {
    if (!onDeletePocket) return
    setDeletingCurrency(currency)
    try {
      await onDeletePocket(wallet.id, currency)
    } finally {
      setDeletingCurrency(null)
    }
  }

  async function handleDeleteWallet() {
    if (!onDeleteWallet) return
    setDeletingWallet(true)
    try {
      await onDeleteWallet(wallet)
      close()
    } catch (err) {
      toast.error(messageOf(err, "Couldn't delete the wallet"))
    } finally {
      setDeletingWallet(false)
    }
  }

  return (
    <form
      className={shellClass}
      onSubmit={(e) => {
        e.preventDefault()
        e.stopPropagation()
        void form.handleSubmit()
      }}
    >
      <FormDialogHeader onClose={close}>
        <Badge
          size="xs"
          variant="secondary"
          className="border-0 bg-primary/10 text-primary"
        >
          <span className="size-1.5 rounded-full bg-primary" />
          Edit wallet
        </Badge>
      </FormDialogHeader>

      <form.Field name="name">
        {(field) => {
          const isInvalid =
            field.state.meta.isTouched && !field.state.meta.isValid
          return (
            <Field data-invalid={isInvalid}>
              <FieldLabel htmlFor={field.name} className={FORM_FIELD_LABEL}>
                Name
              </FieldLabel>
              <div
                className={cn(
                  "flex items-center gap-1.5 rounded-[11px] border border-border bg-card px-1.5 py-1.5 focus-within:border-primary/45",
                  isInvalid && "border-destructive/45"
                )}
              >
                <form.Field name="color">
                  {(colorField) => (
                    <ColorPicker
                      value={asPaletteColor(colorField.state.value)}
                      onChange={(v) => colorField.handleChange(v)}
                      portalContainer={portalContainer}
                    />
                  )}
                </form.Field>
                <form.Field name="icon">
                  {(iconField) => (
                    <IconPicker
                      value={iconField.state.value}
                      onChange={(v) => iconField.handleChange(v)}
                      portalContainer={portalContainer}
                    />
                  )}
                </form.Field>
                <input
                  id={field.name}
                  name={field.name}
                  type="text"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={isInvalid}
                  placeholder="e.g. Main Wallet"
                  className="min-w-0 flex-1 border-0 bg-transparent px-1.5 text-base text-foreground outline-none placeholder:text-muted-foreground/60 md:text-[13px]"
                />
              </div>
              {isInvalid && <FieldError errors={field.state.meta.errors} />}
            </Field>
          )
        }}
      </form.Field>

      {/* Existing pockets */}
      <div className="space-y-2">
        <span className={cn(FORM_FIELD_LABEL, "text-[11.5px] font-medium text-muted-foreground uppercase tracking-wider")}>
          Currency pockets
        </span>
        <div className="rounded-[11px] border border-border bg-card divide-y divide-border overflow-hidden">
          {wallet.pockets.length === 0 && (
            <p className="px-3 py-2.5 text-[12px] text-muted-foreground">
              No currency pockets yet.
            </p>
          )}
          {wallet.pockets.map((pocket) => {
            const txCount = pocketTransactionCounts?.[pocket.accountId] ?? 0
            const hasTx = txCount > 0
            const isDeleting = deletingCurrency === pocket.currency
            return (
              <div
                key={pocket.currency}
                className="flex items-center gap-2.5 px-3 py-2.5"
              >
                <span className="font-mono text-xs font-semibold text-muted-foreground uppercase tracking-widest w-8 shrink-0">
                  {pocket.currency}
                </span>
                <span className="flex-1 tabular-nums text-[13px] text-foreground">
                  {pocket.balance.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <button
                  type="button"
                  disabled={hasTx || isDeleting}
                  onClick={() => handleDeletePocket(pocket.currency)}
                  title={hasTx ? "Has transactions — cannot delete" : "Delete pocket"}
                  className={cn(
                    "grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition",
                    hasTx
                      ? "cursor-not-allowed opacity-40"
                      : "hover:bg-destructive/10 hover:text-destructive",
                    isDeleting && "opacity-50"
                  )}
                >
                  <IconMinus size={13} />
                </button>
              </div>
            )
          })}
        </div>

        {/* Add new pocket */}
        {newPocket !== null ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <CurrencyPicker
                  value={newPocket.currency}
                  onValueChange={(c) => setNewPocket((p) => p ? { ...p, currency: c } : p)}
                  portalContainer={portalContainer}
                />
              </div>
              <div className="w-[130px]">
                <InputGroup className="h-10 items-center rounded-[11px] border-border bg-card px-3">
                  <InputGroupInput
                    type="text"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={newPocket.balance}
                    onChange={(e) => {
                      const value = e.target.value.replace(",", ".")
                      if (value === "" || /^\d{0,12}(\.\d{0,2})?$/.test(value))
                        setNewPocket((p) => p ? { ...p, balance: value } : p)
                    }}
                    className="text-right text-base tabular-nums"
                  />
                  <InputGroupAddon
                    align="inline-end"
                    className="text-[11px] font-semibold tracking-[0.04em] text-muted-foreground"
                  >
                    {newPocket.currency || "—"}
                  </InputGroupAddon>
                </InputGroup>
              </div>
            </div>
            {addPocketError && (
              <p className="text-[11.5px] text-destructive">{addPocketError}</p>
            )}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setNewPocket(null)
                  setAddPocketError(null)
                }}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleAddPocket}
                className="flex-1"
              >
                Add pocket
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setNewPocket({ currency: "", balance: "" })}
            className="w-full"
          >
            <IconPlus size={13} />
            Add currency
          </Button>
        )}
      </div>

      {onDeleteWallet && (
        <div className="flex items-center gap-3 rounded-[11px] border border-destructive/25 bg-destructive/5 p-3">
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[13px] font-medium text-destructive">
              Delete this wallet
            </span>
            <span className="text-[11.5px] text-muted-foreground">
              Permanently removes the wallet and all its pockets. Blocked if any pocket has transactions.
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDeleteWallet}
            disabled={deletingWallet}
            className="shrink-0 border-destructive/35 bg-transparent text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <IconAlertTriangle size={13} />
            {deletingWallet ? "Deleting…" : "Delete"}
          </Button>
        </div>
      )}

      <form.Subscribe
        selector={(s) => [s.canSubmit, s.isSubmitting, s.errorMap] as const}
      >
        {([canSubmit, isSubmitting, errorMap]) => {
          const submitError = errorMap.onSubmit
          const errorText =
            typeof submitError === "string"
              ? submitError
              : submitError &&
                  typeof submitError === "object" &&
                  "form" in submitError
                ? (submitError as { form?: string }).form
                : undefined
          return (
            <FormDialogFooter isMobile={isMobile} error={errorText}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={close}
                disabled={isSubmitting}
                className={cn(
                  FORM_CANCEL_BUTTON,
                  "ml-auto",
                  isMobile && "shrink-0"
                )}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={!canSubmit || isSubmitting}
                className={cn(FORM_SUBMIT_BUTTON, isMobile && "flex-1")}
              >
                {isSubmitting ? "Saving…" : "Save changes"}
              </Button>
            </FormDialogFooter>
          )
        }}
      </form.Subscribe>
    </form>
  )
}

interface PreviewCardProps {
  name: string
  type: string
  currency: string
  balance: number
  isDefault: boolean
  color: string
  icon: string
  pockets?: ReadonlyArray<{ currency: string; balance: number }>
}

function PreviewCard({
  name,
  type,
  currency,
  balance,
  isDefault,
  color,
  icon,
  pockets,
}: PreviewCardProps) {
  const fg = paletteColor(color, { l: 0.78, c: 0.14 })
  const tint = paletteColor(color, { l: 0.42, c: 0.1, a: 0.18 })
  const halo = paletteColor(color, { l: 0.55, c: 0.16, a: 0.3 })
  const displayName = name || "Account name"
  const resolved = getIcon(icon)
  const IconComp = resolved?.component ?? IconCreditCard
  const formatted = balance.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  return (
    <div className="relative flex flex-col gap-3 overflow-hidden rounded-[12px] border border-border bg-card p-3.5">
      <span
        aria-hidden
        className="pointer-events-none absolute -top-[110px] -right-[70px] size-[200px] rounded-full"
        style={{ background: halo, filter: "blur(44px)" }}
      />
      <div className="relative flex items-start gap-2.5">
        <span
          className="grid size-8 shrink-0 place-items-center rounded-[9px] border border-foreground/4"
          style={{ color: fg, background: tint }}
        >
          <IconComp size={16} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex h-4.5 items-center gap-1 text-[11px] text-muted-foreground lowercase">
            <span className="capitalize">{type}</span>
            <span className="opacity-50">·</span>
            <span className="uppercase">{currency}</span>
            {isDefault && (
              <Badge
                size="sm"
                variant="secondary"
                className="ml-1 border-0 bg-primary/10 px-1.5 text-[9px] font-semibold tracking-[0.08em] text-primary uppercase"
              >
                Default
              </Badge>
            )}
          </div>
          <div
            className={cn(
              "truncate font-heading text-[13.5px] font-semibold",
              !name && "text-muted-foreground/60"
            )}
          >
            {displayName}
          </div>
        </div>
      </div>
      {pockets ? (
        <div className="relative flex flex-col gap-1">
          {pockets.length === 0 ? (
            <span className="text-[12px] text-muted-foreground/60">
              Add at least one currency
            </span>
          ) : (
            pockets.map((p, i) => (
              <div
                key={`${p.currency}-${i}`}
                className="flex items-baseline gap-1.5"
              >
                <span className="font-heading text-[18px] font-semibold tracking-tight text-foreground tabular-nums">
                  {p.balance.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span className="text-[11px] tracking-[0.04em] text-muted-foreground uppercase">
                  {p.currency || "—"}
                </span>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="relative flex items-baseline gap-1.5">
          <span className="font-heading text-[22px] font-semibold tracking-tight text-foreground tabular-nums">
            {formatted}
          </span>
          <span className="text-[11px] tracking-[0.04em] text-muted-foreground">
            {currency}
          </span>
        </div>
      )}
    </div>
  )
}
