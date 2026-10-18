import { useState } from "react"
import { IconTag } from "@tabler/icons-react"
import { useForm } from "@tanstack/react-form"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Field, FieldError, FieldLabel } from "@workspace/ui/components/field"
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@workspace/ui/components/select"
import { cn } from "@workspace/ui/lib/utils"
import * as z from "zod"
import type { Category, CategoryType } from "@workspace/api-contract"
import type { PaletteColor } from "@/lib/palette"
import { ColorPicker } from "@/components/color-picker"
import { IconPicker } from "@/components/icon-picker"
import { ICON_TOKENS, getIcon, pickRandomUnusedIcon } from "@/lib/icons"
import {
  PALETTE_TOKENS,
  categoryShadeVars,
  pickRandomUnusedColor,
} from "@/lib/palette"
import { errorMessage } from "@/lib/errors"

function asPaletteColor(s: string | null | undefined): PaletteColor | null {
  return s != null && (PALETTE_TOKENS as ReadonlyArray<string>).includes(s)
    ? (s as PaletteColor)
    : null
}

function asKnownIcon(s: string | null | undefined): string | null {
  return s != null && ICON_TOKENS.includes(s) ? s : null
}

interface FormValues {
  name: string
  parentId: string | null
  color: string
  icon: string
}

// One schema covers both create and edit. Top-level categories require a
// color; subcategories inherit a shade from the parent, so color is optional
// (and dropped on submit) whenever a parent is selected.
const formSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Name is required")
      .max(100, "100 characters or fewer"),
    parentId: z.string().nullable(),
    color: z.string().trim().max(20),
    icon: z.string().trim().max(50),
  })
  .superRefine((data, ctx) => {
    if (data.parentId === null && data.color.length === 0) {
      ctx.addIssue({ code: "custom", path: ["color"], message: "Pick a color" })
    }
  })

export interface CategorySubmitData {
  id: string | null
  name: string
  parentId: string | null
  type: CategoryType
  color: string | null
  icon: string | null
}

interface CategoryFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  category?: Category | null
  parents: ReadonlyArray<Category>
  initialParentId?: string | null
  // Type for new top-level categories. No UI toggle yet — expense for now,
  // income support comes later by passing "income" here.
  initialType?: CategoryType
  existingColors?: ReadonlyArray<string | null>
  existingIcons?: ReadonlyArray<string | null>
  onSubmit: (data: CategorySubmitData) => Promise<void>
}

export function CategoryFormDialog(props: CategoryFormDialogProps) {
  const isEdit = !!props.category
  const startsChild =
    (props.category?.parentId ?? props.initialParentId ?? null) !== null
  const title = isEdit
    ? startsChild
      ? "Edit subcategory"
      : "Edit category"
    : startsChild
      ? "New subcategory"
      : "New category"

  return (
    <FormDialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={title}
    >
      {(ctx) => <CategoryModalBody {...props} ctx={ctx} />}
    </FormDialog>
  )
}

interface ModalBodyProps extends CategoryFormDialogProps {
  ctx: {
    shellClass: string
    portalContainer: HTMLElement | null
    isMobile: boolean
    close: () => void
  }
}

function CategoryModalBody({
  category,
  parents,
  initialParentId,
  initialType,
  existingColors,
  existingIcons,
  onSubmit: onSubmitProp,
  ctx,
}: ModalBodyProps) {
  const isEdit = !!category
  const { shellClass, portalContainer, isMobile, close } = ctx

  const initialParent = category?.parentId ?? initialParentId ?? null
  const parentOfNew =
    initialParent !== null
      ? (parents.find((p) => p.id === initialParent) ?? null)
      : null

  // Type is carried, not editable here. Children inherit it from their parent
  // server-side; top-level categories use the type they were created with.
  const effectiveType: CategoryType =
    category?.type ?? parentOfNew?.type ?? initialType ?? "expense"

  const [initialValues] = useState<FormValues>(() => ({
    name: category?.name ?? "",
    parentId: initialParent,
    color:
      asPaletteColor(category?.color) ??
      asPaletteColor(parentOfNew?.color) ??
      pickRandomUnusedColor(existingColors ?? []),
    icon:
      asKnownIcon(category?.icon) ?? pickRandomUnusedIcon(existingIcons ?? []),
  }))

  const form = useForm({
    defaultValues: initialValues,
    validators: { onChange: formSchema, onSubmit: formSchema },
    onSubmit: async ({ value, formApi }) => {
      const isChild = value.parentId !== null
      try {
        await onSubmitProp({
          id: category?.id ?? null,
          name: value.name.trim(),
          parentId: value.parentId,
          type: effectiveType,
          color: isChild ? null : value.color,
          icon: value.icon.trim() || null,
        })
        close()
      } catch (err) {
        formApi.setErrorMap({
          onSubmit: {
            form: errorMessage(err, "Something went wrong"),
            fields: {},
          },
        })
      }
    },
  })

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
          {isEdit ? "Edit" : "New"}
          {initialParent !== null ? " subcategory" : " category"}
        </Badge>
      </FormDialogHeader>

      <form.Subscribe selector={(s) => s.values}>
        {(values) => {
          const parent =
            values.parentId !== null
              ? (parents.find((p) => p.id === values.parentId) ?? null)
              : null
          const isChild = values.parentId !== null
          return (
            <PreviewCard
              name={values.name}
              type={isChild ? (parent?.type ?? effectiveType) : effectiveType}
              color={isChild ? (parent?.color ?? "neutral") : values.color}
              icon={values.icon}
              parentName={parent?.name ?? null}
            />
          )
        }}
      </form.Subscribe>

      {/* Name, with inline color (top-level only) + icon pickers */}
      <form.Subscribe selector={(s) => s.values.parentId}>
        {(parentId) => {
          const isChild = parentId !== null
          return (
            <form.Field name="name">
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel
                      htmlFor={field.name}
                      className={FORM_FIELD_LABEL}
                    >
                      Name
                    </FieldLabel>
                    <div
                      className={cn(
                        "flex items-center gap-1.5 rounded-[11px] border border-border bg-card p-1.5 focus-within:border-primary/45",
                        isInvalid && "border-destructive/45"
                      )}
                    >
                      {!isChild && (
                        <form.Field name="color">
                          {(colorField) => (
                            <ColorPicker
                              value={asPaletteColor(colorField.state.value)}
                              onChange={(v) => colorField.handleChange(v)}
                              portalContainer={portalContainer}
                            />
                          )}
                        </form.Field>
                      )}
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
                        placeholder="e.g. Food & Drink"
                        className="min-w-0 flex-1 border-0 bg-transparent px-1.5 text-base text-foreground outline-none placeholder:text-muted-foreground/60 md:text-[13px]"
                      />
                    </div>
                    {isInvalid && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            </form.Field>
          )
        }}
      </form.Subscribe>

      {/* Group under — only on create */}
      {!isEdit && parents.length > 0 && (
        <form.Field name="parentId">
          {(field) => {
            const selected =
              field.state.value !== null
                ? (parents.find((p) => p.id === field.state.value) ?? null)
                : null
            return (
              <Field>
                <FieldLabel htmlFor={field.name} className={FORM_FIELD_LABEL}>
                  Group under
                </FieldLabel>
                <Select
                  value={field.state.value ?? "none"}
                  onValueChange={(v) =>
                    field.handleChange(v === "none" ? null : v)
                  }
                >
                  <SelectTrigger
                    id={field.name}
                    size="lg"
                    className={FORM_TRIGGER_ROW}
                  >
                    <span className="flex-1 text-left text-[13px]">
                      {selected ? selected.name : "Top-level category"}
                    </span>
                  </SelectTrigger>
                  <SelectContent position="popper" align="start" sideOffset={6}>
                    <SelectItem value="none">Top-level category</SelectItem>
                    {parents.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )
          }}
        </form.Field>
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
                {isSubmitting ? "Saving…" : isEdit ? "Save changes" : "Create"}
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
  type: CategoryType
  color: string
  icon: string
  parentName: string | null
}

function PreviewCard({
  name,
  type,
  color,
  icon,
  parentName,
}: PreviewCardProps) {
  const displayName = name || (parentName ? "New subcategory" : "New category")
  const resolved = getIcon(icon)
  const IconComp = resolved?.component ?? IconTag
  // Shared chip/halo shade tokens (also used by the categories page and the
  // empty-state tiers) so the preview reads in both light and dark themes.
  const vars = categoryShadeVars(color)

  return (
    <div
      className="relative flex items-center gap-2.5 overflow-hidden rounded-[12px] border border-border bg-card p-3.5"
      style={vars}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -top-27.5 -right-17.5 size-50 rounded-full bg-(--halo-l) dark:bg-(--halo-d)"
        style={{ filter: "blur(44px)" }}
      />
      <span className="relative grid size-9 shrink-0 place-items-center rounded-[9px] border border-foreground/4 bg-(--chip-bg-l) text-(--chip-fg-l) dark:bg-(--chip-bg-d) dark:text-(--chip-fg-d)">
        <IconComp size={18} />
      </span>
      <div className="relative flex min-w-0 flex-1 flex-col gap-0.5">
        <div
          className={cn(
            "truncate font-heading text-[13.5px] font-semibold",
            !name && "text-muted-foreground/60"
          )}
        >
          {displayName}
        </div>
        <div className="flex h-4 items-center gap-1 text-[11px] text-muted-foreground">
          {parentName ? (
            <span className="truncate">in {parentName}</span>
          ) : (
            <>
              <span>{type}</span>
              <span className="opacity-50">·</span>
              <span>{color}</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
