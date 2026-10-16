import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import type { Category } from "@workspace/api-contract"

// "archive" is the primary flow for a live category and still offers the old
// hard delete as a secondary action. "delete" is reached from an already
// archived category, where archiving makes no sense.
export type CategoryDialogMode = "archive" | "delete"

interface CategoryArchiveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  category: Category | null
  mode: CategoryDialogMode
  childCount: number
  transactionCount: number
  onArchive: () => Promise<void>
  onDelete: () => Promise<void>
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}

export function CategoryArchiveDialog({
  open,
  onOpenChange,
  category,
  mode,
  childCount,
  transactionCount,
  onArchive,
  onDelete,
}: CategoryArchiveDialogProps) {
  const [pending, setPending] = useState<"archive" | "delete" | null>(null)
  const noun = category?.parentId ? "subcategory" : "category"

  async function run(action: "archive" | "delete", fn: () => Promise<void>) {
    setPending(action)
    try {
      await fn()
      onOpenChange(false)
    } finally {
      setPending(null)
    }
  }

  const deleteWarning =
    transactionCount > 0 ? (
      <>
        <span className="font-medium text-foreground">
          {plural(transactionCount, "transaction", "transactions")}
        </span>{" "}
        will become uncategorized.
      </>
    ) : (
      "It has no transactions."
    )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "archive" ? "Archive" : "Delete"} &ldquo;
            {category?.name}&rdquo;?
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2 text-sm text-muted-foreground">
          {mode === "archive" ? (
            <>
              <p>
                The {noun} is hidden from pickers and the categories list.
                {childCount > 0 && (
                  <>
                    {" "}
                    Its{" "}
                    <span className="font-medium text-foreground">
                      {plural(childCount, "subcategory", "subcategories")}
                    </span>{" "}
                    go with it.
                  </>
                )}
                {transactionCount > 0 && (
                  <>
                    {" "}
                    <span className="font-medium text-foreground">
                      {plural(transactionCount, "transaction", "transactions")}
                    </span>{" "}
                    stay categorized.
                  </>
                )}{" "}
                You can unarchive it any time.
              </p>
              <p>Delete instead removes it for good. {deleteWarning}</p>
            </>
          ) : (
            <p>
              {childCount > 0 && (
                <>
                  This also deletes{" "}
                  <span className="font-medium text-foreground">
                    {plural(childCount, "subcategory", "subcategories")}
                  </span>
                  .{" "}
                </>
              )}
              {deleteWarning}
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending !== null}
          >
            Cancel
          </Button>
          <Button
            variant={mode === "delete" ? "destructive" : "outline"}
            className={
              mode === "archive"
                ? "border-destructive/35 text-destructive hover:bg-destructive/10 hover:text-destructive"
                : undefined
            }
            onClick={() => run("delete", onDelete)}
            disabled={pending !== null}
          >
            {pending === "delete" ? "Deleting…" : "Delete"}
          </Button>
          {mode === "archive" && (
            <Button
              onClick={() => run("archive", onArchive)}
              disabled={pending !== null}
            >
              {pending === "archive" ? "Archiving…" : "Archive"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
