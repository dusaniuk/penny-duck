import { Button } from "@workspace/ui/components/button"
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@workspace/ui/components/sheet"
import type {
  AccountData,
  CategoryData,
  TransactionFilters,
} from "./transaction-types"

interface TransactionFilterSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  filters: TransactionFilters
  onApply: (filters: TransactionFilters) => void
  accounts: Array<AccountData>
  categories: Array<CategoryData>
}

export function TransactionFilterSheet({
  open,
  onOpenChange,
  filters,
  onApply,
  accounts,
  categories,
}: TransactionFilterSheetProps) {
  const parents = categories.filter((c) => c.parentId === null)
  const childrenByParent = categories.reduce<
    Record<string, Array<CategoryData>>
  >((acc, c) => {
    if (c.parentId !== null) {
      acc[c.parentId] = [...(acc[c.parentId] ?? []), c]
    }
    return acc
  }, {})

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const next: TransactionFilters = {}

    const accountId = form.get("accountId") as string
    if (accountId && accountId !== "__all__") next.accountId = accountId

    const type = form.get("type") as string
    if (type && type !== "__all__") next.type = type

    const categoryId = form.get("categoryId") as string
    if (categoryId && categoryId !== "__all__") next.categoryId = categoryId

    const dateFrom = form.get("dateFrom") as string
    if (dateFrom) next.dateFrom = dateFrom

    const dateTo = form.get("dateTo") as string
    if (dateTo) next.dateTo = dateTo

    onApply(next)
    onOpenChange(false)
  }

  function handleReset() {
    onApply({})
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="mt-6 px-4">
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel>Account</FieldLabel>
              <Select
                name="accountId"
                defaultValue={filters.accountId ?? "__all__"}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All accounts</SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name} ({a.currency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>Type</FieldLabel>
              <Select
                name="type"
                defaultValue={filters.type ?? "__all__"}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All types</SelectItem>
                  <SelectItem value="expense">Expense</SelectItem>
                  <SelectItem value="income">Income</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>Category</FieldLabel>
              <Select
                name="categoryId"
                defaultValue={filters.categoryId ?? "__all__"}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All categories</SelectItem>
                  {parents.map((parent) => (
                    <div key={parent.id}>
                      <SelectItem value={parent.id}>
                        {parent.icon ? `${parent.icon} ` : ""}
                        {parent.name}
                      </SelectItem>
                      {(childrenByParent[parent.id] ?? []).map((child) => (
                        <SelectItem key={child.id} value={child.id}>
                          <span className="pl-4">
                            {child.icon ? `${child.icon} ` : ""}
                            {child.name}
                          </span>
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel>Date from</FieldLabel>
              <Input
                type="date"
                name="dateFrom"
                defaultValue={filters.dateFrom ?? ""}
              />
            </Field>

            <Field>
              <FieldLabel>Date to</FieldLabel>
              <Input
                type="date"
                name="dateTo"
                defaultValue={filters.dateTo ?? ""}
              />
            </Field>

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={handleReset}
              >
                Reset
              </Button>
              <Button type="submit" className="flex-1">
                Apply
              </Button>
            </div>
          </FieldGroup>
        </form>
      </SheetContent>
    </Sheet>
  )
}
