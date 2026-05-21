import { useState } from "react"
import {
  IconAlertTriangle,
  IconCreditCard,
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
import * as z from "zod"
import type { AccountData } from "@/components/accounts/account-card"
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

type AccountType = "bank" | "cash" | "brokerage"

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
    id: "cash",
    name: "Cash",
    desc: "Physical cash on hand or in a safe",
    Icon: IconWallet,
  },
  {
    id: "brokerage",
    name: "Brokerage",
    desc: "Stocks, ETFs, and other investments",
    Icon: IconTrendingUp,
  },
]

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
  type: z.enum(["bank", "cash", "brokerage"]),
  balance: z.string(),
  isDefault: z.boolean(),
  color: z.string().trim().min(1, "Pick a color").max(20),
  icon: z.string().trim().min(1, "Pick an icon").max(50),
})

const createFormSchema = baseSchema.extend({
  currency: z.string().length(3, "Select a currency"),
})

const editFormSchema = baseSchema.extend({
  currency: z.string(),
})

interface AccountFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account?: AccountData | null
  existingAccountColors?: ReadonlyArray<string | null>
  existingAccountIcons?: ReadonlyArray<string | null>
  onSubmit: (data: {
    name: string
    type: string
    currency?: string
    color?: string
    icon?: string
    balance?: number
    isDefault?: boolean
  }) => Promise<void>
  onArchive?: (account: AccountData) => void
}

export function AccountFormDialog(props: AccountFormDialogProps) {
  const title = props.account ? "Edit account" : "New account"

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
  existingAccountColors,
  existingAccountIcons,
  onSubmit: onSubmitProp,
  onArchive,
  ctx,
}: ModalBodyProps) {
  const isEdit = !!account
  const { shellClass, portalContainer, isMobile, close } = ctx

  const schema = isEdit ? editFormSchema : createFormSchema

  const [initialValues] = useState<FormValues>(() => ({
    name: account?.name ?? "",
    type: (account?.type as AccountType) ?? "bank",
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

  const form = useForm({
    defaultValues: initialValues,
    validators: {
      onChange: schema,
      onSubmit: schema,
    },
    onSubmit: async ({ value, formApi }) => {
      try {
        const balanceNum =
          !isEdit && value.balance !== ""
            ? parseFloat(value.balance)
            : undefined
        await onSubmitProp({
          name: value.name.trim(),
          type: value.type,
          ...(isEdit ? {} : { currency: value.currency }),
          color: value.color,
          icon: value.icon,
          ...(balanceNum !== undefined ? { balance: balanceNum } : {}),
          isDefault: value.isDefault,
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
            currency={values.currency || account?.currency || "—"}
            balance={
              isEdit ? (account?.balance ?? 0) : parseFloat(values.balance) || 0
            }
            isDefault={values.isDefault}
            color={values.color}
            icon={values.icon}
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
                  placeholder="e.g. Main Checking"
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

      {isEdit ? (
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
                  <FieldLabel htmlFor={field.name} className={FORM_FIELD_LABEL}>
                    Currency
                  </FieldLabel>
                  <CurrencyPicker
                    id={field.name}
                    value={field.state.value}
                    onValueChange={field.handleChange}
                    invalid={isInvalid}
                    portalContainer={portalContainer}
                  />
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
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
      )}

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

interface PreviewCardProps {
  name: string
  type: string
  currency: string
  balance: number
  isDefault: boolean
  color: string
  icon: string
}

function PreviewCard({
  name,
  type,
  currency,
  balance,
  isDefault,
  color,
  icon,
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
      <div className="relative flex items-baseline gap-1.5">
        <span className="font-heading text-[22px] font-semibold tracking-tight text-foreground tabular-nums">
          {formatted}
        </span>
        <span className="text-[11px] tracking-[0.04em] text-muted-foreground">
          {currency}
        </span>
      </div>
    </div>
  )
}
