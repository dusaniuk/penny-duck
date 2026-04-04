import {
  IconDotsVertical,
  IconEdit,
  IconPlus,
  IconTrash,
} from "@tabler/icons-react"
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent, CardHeader } from "@workspace/ui/components/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"

export interface CategoryData {
  id: string
  parentId: string | null
  name: string
  icon: string | null
}

interface CategoryCardProps {
  parent: CategoryData
  children: Array<CategoryData>
  onEditParent: (category: CategoryData) => void
  onDeleteParent: (category: CategoryData) => void
  onEditChild: (category: CategoryData) => void
  onDeleteChild: (category: CategoryData) => void
  onAddChild: (parentId: string) => void
}

export function CategoryCard({
  parent,
  children,
  onEditParent,
  onDeleteParent,
  onEditChild,
  onDeleteChild,
  onAddChild,
}: CategoryCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <p className="font-heading text-sm font-medium">
            {parent.icon ? `${parent.icon} ` : ""}
            {parent.name}
          </p>
          <DropdownMenu>
            <DropdownMenuTrigger className="shrink-0 rounded p-0.5 hover:bg-accent">
              <IconDotsVertical className="size-4 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEditParent(parent)}>
                <IconEdit />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => onDeleteParent(parent)}
              >
                <IconTrash />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-1.5">
          {children.map((child) => (
            <DropdownMenu key={child.id}>
              <DropdownMenuTrigger asChild>
                <Badge
                  variant="outline"
                  className="cursor-pointer gap-1 hover:bg-muted"
                >
                  {child.icon ? `${child.icon} ` : ""}
                  {child.name}
                  <IconDotsVertical className="size-2.5 text-muted-foreground" />
                </Badge>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => onEditChild(child)}>
                  <IconEdit />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => onDeleteChild(child)}
                >
                  <IconTrash />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ))}
          <Badge
            variant="outline"
            className="cursor-pointer gap-1 border-dashed hover:bg-muted"
            onClick={() => onAddChild(parent.id)}
          >
            <IconPlus className="size-2.5" />
            add
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}

interface AddCategoryCardProps {
  onClick: () => void
}

export function AddCategoryCard({ onClick }: AddCategoryCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[100px] w-full cursor-pointer items-center justify-center rounded-lg border border-dashed border-foreground/20 text-sm text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
    >
      + Add Category
    </button>
  )
}
