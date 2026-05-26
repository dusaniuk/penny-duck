import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import type { Category } from "@workspace/api-contract"

interface CategoryDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  category: Category | null
  childCount: number
  transactionCount: number
  onConfirm: () => Promise<void>
}

export function CategoryDeleteDialog({
  open,
  onOpenChange,
  category,
  childCount,
  transactionCount,
  onConfirm,
}: CategoryDeleteDialogProps) {
  const [loading, setLoading] = useState(false)

  async function handleConfirm() {
    setLoading(true)
    try {
      await onConfirm()
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete &ldquo;{category?.name}&rdquo;?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {childCount > 0 && (
            <>
              This will also delete{" "}
              <span className="font-medium text-foreground">
                {childCount} subcategor{childCount === 1 ? "y" : "ies"}
              </span>
              .{" "}
            </>
          )}
          {transactionCount > 0 ? (
            <>
              <span className="font-medium text-foreground">
                {transactionCount} transaction
                {transactionCount !== 1 ? "s" : ""}
              </span>{" "}
              will become uncategorized.
            </>
          ) : (
            "This category has no transactions."
          )}
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
