import type {
  Account,
  AccountUsageItem,
  Category,
  CategoryUsageItem,
} from "@workspace/api-contract"

// Shared by the quick-pick chips: the first `count` items of a ranked list,
// with the current selection swapped in when it ranks below the cut-off so the
// active chip always lights up.
function headWithSelected<T extends { id: string }>(
  ranked: Array<T>,
  selectedId: string | null,
  count: number
): Array<T> {
  const head = ranked.slice(0, count)
  const selected = selectedId ? ranked.find((i) => i.id === selectedId) : null
  if (selected && !head.includes(selected)) {
    return [selected, ...head.slice(0, count - 1)]
  }
  return head
}

// Most used subcategories first, then alphabetical. Parents are group headers
// in every picker, so they are never suggested.
export function suggestCategories(
  categories: ReadonlyArray<Category>,
  usage: ReadonlyArray<CategoryUsageItem>,
  selectedId: string | null,
  count: number
): Array<Category> {
  const usageById = new Map(usage.map((u) => [u.categoryId, u.count]))
  const ranked = categories
    .filter((c) => c.parentId !== null)
    .sort(
      (a, b) =>
        (usageById.get(b.id) ?? 0) - (usageById.get(a.id) ?? 0) ||
        a.name.localeCompare(b.name)
    )
  return headWithSelected(ranked, selectedId, count)
}

// Same order as the transaction form: default account, then most used, then
// alphabetical.
export function suggestAccounts(
  accounts: ReadonlyArray<Account>,
  usage: ReadonlyArray<AccountUsageItem>,
  selectedId: string,
  count: number
): Array<Account> {
  const usageById = new Map(usage.map((u) => [u.accountId, u.count]))
  const ranked = [...accounts].sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1
    return (
      (usageById.get(b.id) ?? 0) - (usageById.get(a.id) ?? 0) ||
      a.name.localeCompare(b.name)
    )
  })
  return headWithSelected(ranked, selectedId || null, count)
}
