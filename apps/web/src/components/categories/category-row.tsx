import { useState } from "react"
import {
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconDotsVertical,
  IconEdit,
  IconPlus,
  IconTrash,
  IconX,
} from "@tabler/icons-react"
import { Input } from "@workspace/ui/components/input"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { IconPicker } from "./icon-picker"
import type { Category } from "@workspace/api-contract"
import { getCategoryIcon } from "@/lib/category-icons"

export type CategoryData = Category

interface CategoryRowProps {
  parent: CategoryData
  children: Array<CategoryData>
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

function CategoryIcon({ icon }: { icon: string | null }) {
  const resolved = getCategoryIcon(icon)
  if (resolved) {
    return (
      <resolved.component className="size-4 shrink-0 text-muted-foreground" />
    )
  }
  return (
    <span className="flex size-4 shrink-0 items-center justify-center text-sm">
      {icon ?? ""}
    </span>
  )
}

interface EditableRowProps {
  initial?: { name: string; icon: string | null }
  onSave: (data: { name: string; icon?: string }) => Promise<void>
  onCancel: () => void
  indent?: boolean
}

function EditableRow({ initial, onSave, onCancel, indent }: EditableRowProps) {
  const [name, setName] = useState(initial?.name ?? "")
  const [icon, setIcon] = useState<string | null>(initial?.icon ?? null)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    if (!name.trim() || saving) return
    setSaving(true)
    try {
      await onSave({ name: name.trim(), ...(icon ? { icon } : {}) })
    } finally {
      setSaving(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSave()
    if (e.key === "Escape") onCancel()
  }

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 ${indent ? "pl-10" : ""}`}
    >
      <IconPicker value={icon} onChange={setIcon} />
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Category name"
        className="h-8 flex-1 text-sm"
        autoFocus
        disabled={saving}
      />
      <button
        type="button"
        onClick={handleSave}
        disabled={!name.trim() || saving}
        className="rounded-md p-1 text-green-500 transition-colors hover:bg-accent disabled:opacity-50"
      >
        <IconCheck className="size-4" />
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent"
      >
        <IconX className="size-4" />
      </button>
    </div>
  )
}

export function CategoryRow({
  parent,
  children,
  onEdit,
  onCreate,
  onDelete,
}: CategoryRowProps) {
  const [open, setOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addingChild, setAddingChild] = useState(false)

  async function handleSaveEdit(
    id: string,
    data: { name: string; icon?: string }
  ) {
    await onEdit(id, data)
    setEditingId(null)
  }

  async function handleCreateChild(data: { name: string; icon?: string }) {
    await onCreate({ ...data, parentId: parent.id })
    setAddingChild(false)
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border">
        {editingId === parent.id ? (
          <EditableRow
            initial={{ name: parent.name, icon: parent.icon }}
            onSave={(data) => handleSaveEdit(parent.id, data)}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <div className="flex items-center">
            <CollapsibleTrigger className="flex flex-1 items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/50">
              {open ? (
                <IconChevronDown className="size-4 shrink-0 text-muted-foreground" />
              ) : (
                <IconChevronRight className="size-4 shrink-0 text-muted-foreground" />
              )}
              <CategoryIcon icon={parent.icon} />
              <span className="flex-1 text-sm font-medium">{parent.name}</span>
              {!open && children.length > 0 && (
                <span className="text-xs text-muted-foreground">
                  {children.length}
                </span>
              )}
            </CollapsibleTrigger>
            <DropdownMenu>
              <DropdownMenuTrigger className="shrink-0 rounded p-2 hover:bg-accent">
                <IconDotsVertical className="size-4 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => {
                    setEditingId(parent.id)
                    setOpen(true)
                  }}
                >
                  <IconEdit />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => onDelete(parent)}
                >
                  <IconTrash />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        <CollapsibleContent>
          <div className="border-t">
            {children.map((child) =>
              editingId === child.id ? (
                <EditableRow
                  key={child.id}
                  initial={{ name: child.name, icon: child.icon }}
                  onSave={(data) => handleSaveEdit(child.id, data)}
                  onCancel={() => setEditingId(null)}
                  indent
                />
              ) : (
                <div
                  key={child.id}
                  className="flex items-center gap-2 border-b border-border/50 py-2 pl-10 pr-3 last:border-b-0"
                >
                  <CategoryIcon icon={child.icon} />
                  <span className="flex-1 text-sm text-muted-foreground">
                    {child.name}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="shrink-0 rounded p-1 hover:bg-accent">
                      <IconDotsVertical className="size-3.5 text-muted-foreground" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => setEditingId(child.id)}
                      >
                        <IconEdit />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={() => onDelete(child)}
                      >
                        <IconTrash />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )
            )}

            {addingChild ? (
              <EditableRow
                onSave={handleCreateChild}
                onCancel={() => setAddingChild(false)}
                indent
              />
            ) : (
              <button
                type="button"
                onClick={() => setAddingChild(true)}
                className="flex w-full items-center gap-2 py-2 pl-10 pr-3 text-xs text-muted-foreground transition-colors hover:bg-muted/50"
              >
                <IconPlus className="size-3.5" />
                Add subcategory
              </button>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
