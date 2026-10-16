import type { Category } from "@workspace/api-contract"

export function isArchivedCategory(category: Category): boolean {
  return category.archivedAt != null
}

// Archived categories stay in the /categories response so historical rows
// keep their name and colour. Pickers and the categories grid use this to
// hide them; history views (rows, filters, spendings) keep the full list.
export function activeCategories(
  categories: ReadonlyArray<Category>
): Array<Category> {
  return categories.filter((c) => !isArchivedCategory(c))
}

// Active categories plus whatever the form currently has selected, so editing
// an old transaction filed under an archived category still shows that choice
// (and its parent, which the picker needs to render the child).
export function pickableCategories(
  categories: ReadonlyArray<Category>,
  selectedId: string | null
): Array<Category> {
  const selected = selectedId
    ? categories.find((c) => c.id === selectedId)
    : undefined
  if (!selected || !isArchivedCategory(selected)) {
    return activeCategories(categories)
  }
  const keep = new Set([selected.id, selected.parentId].filter(Boolean))
  return categories.filter((c) => !isArchivedCategory(c) || keep.has(c.id))
}
