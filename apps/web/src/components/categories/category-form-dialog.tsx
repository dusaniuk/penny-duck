import { useEffect, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@workspace/ui/components/responsive-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { IconPicker } from "./icon-picker"
import type { Category, CategoryType } from "@workspace/api-contract"

const TOP_LEVEL_VALUE = "TOP_LEVEL"

export type CategoryDialogMode =
  | { kind: "create-parent"; type: CategoryType }
  | { kind: "create-child"; parent: Category }
  | { kind: "edit"; category: Category; isParent: boolean }

interface CategoryFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: CategoryDialogMode | null
  parentOptions: Array<Category>
  hasChildren: boolean
  onSubmit: (data: {
    name: string
    icon?: string
    type?: CategoryType
    parentId?: string | null
  }) => Promise<void>
}

export function CategoryFormDialog({
  open,
  onOpenChange,
  mode,
  parentOptions,
  hasChildren,
  onSubmit,
}: CategoryFormDialogProps) {
  const [name, setName] = useState("")
  const [icon, setIcon] = useState<string | null>(null)
  const [type, setType] = useState<CategoryType>("expense")
  const [parentSelection, setParentSelection] =
    useState<string>(TOP_LEVEL_VALUE)
  const [initialParentSelection, setInitialParentSelection] =
    useState<string>(TOP_LEVEL_VALUE)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!mode) return
    setError(null)
    if (mode.kind === "edit") {
      setName(mode.category.name)
      setIcon(mode.category.icon)
      setType(mode.category.type)
      const initial = mode.category.parentId ?? TOP_LEVEL_VALUE
      setParentSelection(initial)
      setInitialParentSelection(initial)
    } else if (mode.kind === "create-parent") {
      setName("")
      setIcon(null)
      setType(mode.type)
      setParentSelection(TOP_LEVEL_VALUE)
      setInitialParentSelection(TOP_LEVEL_VALUE)
    } else {
      setName("")
      setIcon(null)
      setType(mode.parent.type)
      setParentSelection(TOP_LEVEL_VALUE)
      setInitialParentSelection(TOP_LEVEL_VALUE)
    }
  }, [mode])

  if (!mode) return null

  const isEdit = mode.kind === "edit"
  const showTypeTabs =
    isEdit && mode.isParent && parentSelection === TOP_LEVEL_VALUE
  const showMoveField =
    mode.kind === "edit" && (!mode.isParent || !hasChildren)
  const showHasChildrenNote =
    mode.kind === "edit" && mode.isParent && hasChildren
  const eligibleParentOptions =
    mode.kind === "edit"
      ? parentOptions.filter((o) => o.id !== mode.category.id)
      : parentOptions
  const trimmed = name.trim()

  let title: string
  if (mode.kind === "edit") {
    title = `Edit ${mode.category.name}`
  } else if (mode.kind === "create-parent") {
    title =
      mode.type === "expense" ? "New Expense Category" : "New Income Category"
  } else {
    title = `New Subcategory in ${mode.parent.name}`
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!trimmed || loading) return
    setLoading(true)
    setError(null)
    try {
      const parentChanged = parentSelection !== initialParentSelection
      const parentId =
        parentSelection === TOP_LEVEL_VALUE ? null : parentSelection
      await onSubmit({
        name: trimmed,
        ...(icon ? { icon } : {}),
        ...(showTypeTabs ? { type } : {}),
        ...(parentChanged ? { parentId } : {}),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next && loading) return
    onOpenChange(next)
  }

  return (
    <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{title}</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldGroup className="gap-3 pt-2">
            {showTypeTabs && (
              <Tabs
                value={type}
                onValueChange={(v) => setType(v as CategoryType)}
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
                </TabsList>
              </Tabs>
            )}

            <Field>
              <FieldLabel>Name</FieldLabel>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Category name"
                autoFocus
                disabled={loading}
                maxLength={100}
              />
            </Field>

            <Field>
              <FieldLabel>Icon</FieldLabel>
              <div className="flex">
                <IconPicker value={icon} onChange={setIcon} />
              </div>
            </Field>

            {showMoveField && (
              <Field>
                <FieldLabel>Group under</FieldLabel>
                <Select
                  value={parentSelection}
                  onValueChange={setParentSelection}
                  disabled={loading}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TOP_LEVEL_VALUE}>(Top-level)</SelectItem>
                    {eligibleParentOptions.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {opt.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            {showHasChildrenNote && (
              <p className="text-sm text-muted-foreground">
                This category has subcategories and can&apos;t be moved.
              </p>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={!trimmed || loading}>
                {loading ? "Saving…" : isEdit ? "Save" : "Create"}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  )
}
