import { IconPlus } from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import { CategoryRow } from "./category-row"
import type { Category, CategoryType } from "@workspace/api-contract"

interface CategoryListProps {
  type: CategoryType
  categories: Array<Category>
  allCategories: ReadonlyArray<Category>
  onAddParent: () => void
  onAddChild: (parent: Category) => void
  onEdit: (category: Category, isParent: boolean) => void
  onDelete: (category: Category) => void
}

export function CategoryList({
  categories,
  allCategories,
  onAddParent,
  onAddChild,
  onEdit,
  onDelete,
}: CategoryListProps) {
  const parents = categories.filter((c) => c.parentId === null)
  const childrenByParentId = categories.reduce<Record<string, Array<Category>>>(
    (acc, c) => {
      if (c.parentId !== null) {
        acc[c.parentId] = [...(acc[c.parentId] ?? []), c]
      }
      return acc
    },
    {}
  )

  return (
    <div className="space-y-2">
      {parents.map((parent) => (
        <CategoryRow
          key={parent.id}
          parent={parent}
          children={childrenByParentId[parent.id] ?? []}
          allCategories={allCategories}
          onAddChild={onAddChild}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}

      <Button
        variant="outline"
        className="w-full border-dashed"
        onClick={onAddParent}
      >
        <IconPlus className="size-4" />
        Add Category
      </Button>
    </div>
  )
}
