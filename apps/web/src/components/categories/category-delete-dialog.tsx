import { useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@workspace/ui/components/alert-dialog"
import type { Category } from "@workspace/api-contract"

interface CategoryDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  category: Category | null
  isParent: boolean
  onConfirm: () => Promise<void>
}

export function CategoryDeleteDialog({
  open,
  onOpenChange,
  category,
  isParent,
  onConfirm,
}: CategoryDeleteDialogProps) {
  const [loading, setLoading] = useState(false)

  async function handleConfirm(e: React.MouseEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Delete &ldquo;{category?.name}&rdquo;?
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isParent
              ? "This will delete this category and all its subcategories."
              : "This will permanently delete this subcategory."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? "Deleting…" : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
