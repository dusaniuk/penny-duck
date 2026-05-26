import { useMemo } from "react"
import {
  IconPencil,
  IconPlus,
  IconTag,
  IconTrash,
} from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import { cn } from "@workspace/ui/lib/utils"
import type { Category, CategoryType } from "@workspace/api-contract"
import { getIcon } from "@/lib/icons"
import { categoryColor } from "@/lib/palette"

interface CategoryListProps {
  categories: ReadonlyArray<Category>
  onEdit: (category: Category) => void
  onDelete: (category: Category) => void
  onAddChild: (parent: Category) => void
}

const GROUPS: ReadonlyArray<{ type: CategoryType; label: string }> = [
  { type: "expense", label: "Expense" },
  { type: "income", label: "Income" },
]

export function CategoryList({
  categories,
  onEdit,
  onDelete,
  onAddChild,
}: CategoryListProps) {
  const childrenByParent = useMemo(() => {
    const map = new Map<string, Array<Category>>()
    for (const c of categories) {
      if (c.parentId === null) continue
      const arr = map.get(c.parentId)
      if (arr) arr.push(c)
      else map.set(c.parentId, [c])
    }
    for (const arr of map.values())
      arr.sort((a, b) => a.name.localeCompare(b.name))
    return map
  }, [categories])

  const parentsByType = useMemo(() => {
    const map = new Map<CategoryType, Array<Category>>()
    for (const c of categories) {
      if (c.parentId !== null) continue
      const arr = map.get(c.type)
      if (arr) arr.push(c)
      else map.set(c.type, [c])
    }
    for (const arr of map.values())
      arr.sort((a, b) => a.name.localeCompare(b.name))
    return map
  }, [categories])

  return (
    <div className="space-y-8">
      {GROUPS.map(({ type, label }) => {
        const parents = parentsByType.get(type) ?? []
        if (parents.length === 0) return null
        return (
          <section key={type} className="space-y-2.5">
            <h2 className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
              {label}
            </h2>
            <div className="space-y-1.5">
              {parents.map((parent) => {
                const children = childrenByParent.get(parent.id) ?? []
                return (
                  <div key={parent.id} className="space-y-1.5">
                    <CategoryRow
                      category={parent}
                      all={categories}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onAddChild={onAddChild}
                    />
                    {children.length > 0 && (
                      <div className="ml-4 space-y-1.5 border-l border-border pl-4">
                        {children.map((child) => (
                          <CategoryRow
                            key={child.id}
                            category={child}
                            all={categories}
                            onEdit={onEdit}
                            onDelete={onDelete}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

interface CategoryRowProps {
  category: Category
  all: ReadonlyArray<Category>
  onEdit: (category: Category) => void
  onDelete: (category: Category) => void
  onAddChild?: (parent: Category) => void
}

function CategoryRow({
  category,
  all,
  onEdit,
  onDelete,
  onAddChild,
}: CategoryRowProps) {
  const color = categoryColor(category, all)
  const isParent = category.parentId === null
  const resolved = getIcon(category.icon)
  const IconComp = resolved?.component ?? IconTag

  return (
    <div className="group flex items-center gap-3 rounded-[11px] border border-border bg-card px-3 py-2.5">
      <span
        className={cn(
          "grid shrink-0 place-items-center rounded-[9px] bg-foreground/[0.06]",
          isParent ? "size-8" : "size-7"
        )}
        style={{ color }}
      >
        <IconComp size={isParent ? 16 : 14} />
      </span>
      <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-foreground">
        {category.name}
      </span>
      <div className="flex items-center gap-0.5 text-muted-foreground">
        {isParent && onAddChild && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Add subcategory to ${category.name}`}
            onClick={() => onAddChild(category)}
            className="hover:text-foreground"
          >
            <IconPlus size={16} />
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Edit ${category.name}`}
          onClick={() => onEdit(category)}
          className="hover:text-foreground"
        >
          <IconPencil size={16} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={`Delete ${category.name}`}
          onClick={() => onDelete(category)}
          className="hover:text-destructive"
        >
          <IconTrash size={16} />
        </Button>
      </div>
    </div>
  )
}
