import { useState } from "react"
import { IconCheck, IconPlus, IconX } from "@tabler/icons-react"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {  CategoryRow } from "./category-row"
import { IconPicker } from "./icon-picker"
import type {CategoryData} from "./category-row";

interface CategoryListProps {
  categories: Array<CategoryData>
  onEdit: (
    id: string,
    data: { name: string; icon?: string }
  ) => Promise<void>
  onCreate: (data: {
    name: string
    icon?: string
    parentId: string | null
  }) => Promise<void>
  onDelete: (category: CategoryData) => void
}

export function CategoryList({
  categories,
  onEdit,
  onCreate,
  onDelete,
}: CategoryListProps) {
  const [addingParent, setAddingParent] = useState(false)
  const [newName, setNewName] = useState("")
  const [newIcon, setNewIcon] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const parents = categories.filter((c) => c.parentId === null)
  const childrenByParentId = categories.reduce<
    Record<string, Array<CategoryData>>
  >((acc, c) => {
    if (c.parentId !== null) {
      acc[c.parentId] = [...(acc[c.parentId] ?? []), c]
    }
    return acc
  }, {})

  async function handleCreateParent() {
    if (!newName.trim() || saving) return
    setSaving(true)
    try {
      await onCreate({
        name: newName.trim(),
        ...(newIcon ? { icon: newIcon } : {}),
        parentId: null,
      })
      setAddingParent(false)
      setNewName("")
      setNewIcon(null)
    } finally {
      setSaving(false)
    }
  }

  function handleCancelAdd() {
    setAddingParent(false)
    setNewName("")
    setNewIcon(null)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleCreateParent()
    if (e.key === "Escape") handleCancelAdd()
  }

  return (
    <div className="space-y-2">
      {parents.map((parent) => (
        <CategoryRow
          key={parent.id}
          parent={parent}
          children={childrenByParentId[parent.id] ?? []}
          onEdit={onEdit}
          onCreate={onCreate}
          onDelete={onDelete}
        />
      ))}

      {addingParent ? (
        <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
          <IconPicker value={newIcon} onChange={setNewIcon} />
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Category name"
            className="h-8 flex-1 text-sm"
            autoFocus
            disabled={saving}
          />
          <button
            type="button"
            onClick={handleCreateParent}
            disabled={!newName.trim() || saving}
            className="rounded-md p-1 text-green-500 transition-colors hover:bg-accent disabled:opacity-50"
          >
            <IconCheck className="size-4" />
          </button>
          <button
            type="button"
            onClick={handleCancelAdd}
            disabled={saving}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent"
          >
            <IconX className="size-4" />
          </button>
        </div>
      ) : (
        <Button
          variant="outline"
          className="w-full border-dashed"
          onClick={() => setAddingParent(true)}
        >
          <IconPlus className="size-4" />
          Add Category
        </Button>
      )}
    </div>
  )
}
