import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Button } from "@workspace/ui/components/button"
import type { CategoryData } from "@/components/categories/category-card"

interface CategoryFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  category?: CategoryData | null
  parentId?: string | null
  onSubmit: (data: {
    name: string
    icon?: string
    parentId?: string | null
  }) => Promise<void>
}

export function CategoryFormDialog({
  open,
  onOpenChange,
  category,
  parentId,
  onSubmit,
}: CategoryFormDialogProps) {
  const isEdit = !!category

  const [name, setName] = useState("")
  const [icon, setIcon] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      setName(category?.name ?? "")
      setIcon(category?.icon ?? "")
      setError(null)
    }
  }, [open, category])

  function getTitle() {
    if (isEdit) return "Edit Category"
    if (parentId) return "Add Subcategory"
    return "Add Category"
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const data: { name: string; icon?: string; parentId?: string | null } = {
        name,
        ...(icon.trim() ? { icon: icon.trim() } : {}),
      }
      if (!isEdit) {
        data.parentId = parentId ?? null
      }
      await onSubmit(data)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <FieldGroup className="gap-3">
            <Field>
              <FieldLabel>Name</FieldLabel>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Food & Drink"
                required
              />
            </Field>

            <Field>
              <FieldLabel>Icon</FieldLabel>
              <Input
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="e.g. shopping-cart"
              />
            </Field>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving…" : isEdit ? "Save Changes" : "Create"}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </DialogContent>
    </Dialog>
  )
}
