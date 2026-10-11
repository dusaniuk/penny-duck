import { useEffect, useState } from "react"
import { IconTag } from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import {
  Select,
  SelectContent,
  SelectGroup,
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
import type { Account, Category, Member } from "@workspace/api-contract"
import { DatePicker } from "@/components/date-picker"
import { getIcon } from "@/lib/icons"

type AccountData = Account
type CategoryData = Category

interface TransactionFilters {
  accountId?: string
  type?: string
  categoryId?: string
  settled?: boolean
  dateFrom?: string
  dateTo?: string
  madeById?: string
}

interface TransactionFilterSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  filters: TransactionFilters
  onApply: (filters: TransactionFilters) => void
  accounts: Array<AccountData>
  categories: Array<CategoryData>
  members: Array<Member>
}

export function TransactionFilterSheet({
  open,
  onOpenChange,
  filters,
  onApply,
  accounts,
  categories,
  members,
}: TransactionFilterSheetProps) {
  // The sheet stays mounted while closed, so re-sync the controlled date
  // fields with the applied filters each time it opens.
  const [dateFrom, setDateFrom] = useState(filters.dateFrom ?? "")
  const [dateTo, setDateTo] = useState(filters.dateTo ?? "")
  useEffect(() => {
    if (open) {
      setDateFrom(filters.dateFrom ?? "")
      setDateTo(filters.dateTo ?? "")
    }
  }, [open, filters.dateFrom, filters.dateTo])

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

    if (dateFrom) next.dateFrom = dateFrom
    if (dateTo) next.dateTo = dateTo

    const madeById = form.get("madeById") as string
    if (madeById && madeById !== "__all__") next.madeById = madeById

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
                <SelectContent position="popper" align="start" sideOffset={6}>
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
              <Select name="type" defaultValue={filters.type ?? "__all__"}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" align="start" sideOffset={6}>
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
                <SelectContent position="popper" align="start" sideOffset={6}>
                  <SelectItem value="__all__">All categories</SelectItem>
                  {parents.map((parent) => (
                    <SelectGroup key={parent.id}>
                      <SelectItem value={parent.id}>
                        <CategoryIcon icon={parent.icon} />
                        {parent.name}
                      </SelectItem>
                      {(childrenByParent[parent.id] ?? []).map((child) => (
                        <SelectItem
                          key={child.id}
                          value={child.id}
                          className="pl-5.5"
                        >
                          <CategoryIcon icon={child.icon} />
                          {child.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            {members.length > 1 && (
              <Field>
                <FieldLabel>Member</FieldLabel>
                <Select
                  name="madeById"
                  defaultValue={filters.madeById ?? "__all__"}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" align="start" sideOffset={6}>
                    <SelectItem value="__all__">All members</SelectItem>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            <Field>
              <FieldLabel>Date from</FieldLabel>
              <DatePicker
                value={dateFrom}
                onChange={setDateFrom}
                clearable
                placeholder="Any date"
              />
            </Field>

            <Field>
              <FieldLabel>Date to</FieldLabel>
              <DatePicker
                value={dateTo}
                onChange={setDateTo}
                clearable
                placeholder="Any date"
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

function CategoryIcon({ icon }: { icon: string | null }) {
  const Icon = getIcon(icon)?.component ?? IconTag
  return <Icon className="size-4 text-muted-foreground" />
}
