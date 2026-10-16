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

export type PickerGroup = { parent: Category; children: Array<Category> }

// Parents are headers, not choices, in the category picker. A parent earns a
// header only while it has at least one selectable child left after the
// upstream archive filter and the search query; otherwise it is dropped.
export function pickerGroups(
  categories: ReadonlyArray<Category>,
  query: string
): Array<PickerGroup> {
  const q = query.trim().toLowerCase()
  const matches = (c: Category) => q === "" || c.name.toLowerCase().includes(q)
  const childrenByParent = new Map<string, Array<Category>>()
  for (const c of categories) {
    if (c.parentId === null) continue
    const list = childrenByParent.get(c.parentId) ?? []
    list.push(c)
    childrenByParent.set(c.parentId, list)
  }
  return categories.flatMap((parent) => {
    if (parent.parentId !== null) return []
    const children = (childrenByParent.get(parent.id) ?? []).filter(matches)
    return children.length > 0 ? [{ parent, children }] : []
  })
}
