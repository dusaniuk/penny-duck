import { useState } from "react"
import {
  IconChevronDown,
  IconChevronRight,
  IconDotsVertical,
  IconEdit,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react"
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
import type { Category } from "@workspace/api-contract"
import { getCategoryIcon } from "@/lib/category-icons"

interface CategoryRowProps {
  parent: Category
  children: Array<Category>
  onAddChild: (parent: Category) => void
  onEdit: (category: Category, isParent: boolean) => void
  onDelete: (category: Category) => void
}

function CategoryIcon({ icon }: { icon: string | null }) {
  const resolved = getCategoryIcon(icon)
  if (resolved) {
    return (
      <resolved.component className="size-4 shrink-0 text-muted-foreground" />
    )
  }
  return (
    <span className="flex size-4 shrink-0 items-center justify-center text-base">
      {icon ?? ""}
    </span>
  )
}

export function CategoryRow({
  parent,
  children,
  onAddChild,
  onEdit,
  onDelete,
}: CategoryRowProps) {
  const [open, setOpen] = useState(false)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border">
        <div className="flex items-center">
          <CollapsibleTrigger className="flex flex-1 items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-muted/50">
            {open ? (
              <IconChevronDown className="size-4 shrink-0 text-muted-foreground" />
            ) : (
              <IconChevronRight className="size-4 shrink-0 text-muted-foreground" />
            )}
            <CategoryIcon icon={parent.icon} />
            <span className="flex-1 text-base font-medium">{parent.name}</span>
            {!open && children.length > 0 && (
              <span className="text-sm text-muted-foreground">
                {children.length}
              </span>
            )}
          </CollapsibleTrigger>
          <DropdownMenu>
            <DropdownMenuTrigger className="shrink-0 rounded p-2 hover:bg-accent">
              <IconDotsVertical className="size-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(parent, true)}>
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

        <CollapsibleContent>
          <div className="border-t">
            {children.map((child) => (
              <div
                key={child.id}
                className="flex items-center gap-2 border-b border-border/50 py-2 pl-10 pr-3 last:border-b-0"
              >
                <CategoryIcon icon={child.icon} />
                <span className="flex-1 text-base text-muted-foreground">
                  {child.name}
                </span>
                <DropdownMenu>
                  <DropdownMenuTrigger className="shrink-0 rounded p-1 hover:bg-accent">
                    <IconDotsVertical className="size-3.5 text-muted-foreground" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => onEdit(child, false)}>
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
            ))}

            <button
              type="button"
              onClick={() => onAddChild(parent)}
              className="flex w-full items-center gap-2 py-2 pl-10 pr-3 text-sm text-muted-foreground transition-colors hover:bg-muted/50"
            >
              <IconPlus className="size-3.5" />
              Add subcategory
            </button>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}
