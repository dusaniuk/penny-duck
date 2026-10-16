import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"

// The thing being archived: a leaf account or a wallet. Only what the copy and
// the API call need — the page resolves the full record.
export type ArchiveTarget = { id: string; name: string; type: string }

interface AccountArchiveDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  target: ArchiveTarget | null
  transactionCount: number
  onArchive: () => Promise<void>
  onDelete: () => Promise<void>
}

export function AccountArchiveDialog({
  open,
  onOpenChange,
  target,
  transactionCount,
  onArchive,
  onDelete,
}: AccountArchiveDialogProps) {
  const [pending, setPending] = useState<"archive" | "delete" | null>(null)
  const noun = target?.type === "wallet" ? "wallet" : "account"
  const canDelete = transactionCount === 0

  async function run(action: "archive" | "delete", fn: () => Promise<void>) {
    setPending(action)
    try {
      await fn()
      onOpenChange(false)
    } finally {
      setPending(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Archive &ldquo;{target?.name}&rdquo;?</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            The {noun} is hidden from totals, pickers and the accounts grid.
            {transactionCount > 0 ? (
              <>
                {" "}
                Its{" "}
                <span className="font-medium text-foreground">
                  {transactionCount} transaction
                  {transactionCount !== 1 ? "s" : ""}
                </span>{" "}
                stay where they are.
              </>
            ) : null}{" "}
            You can unarchive it any time.
          </p>
          {canDelete && (
            <p>
              It has no transactions yet, so you can also delete it for good.
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
          {canDelete && (
            <Button
              variant="outline"
              className="border-destructive/35 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => run("delete", onDelete)}
              disabled={pending !== null}
            >
              {pending === "delete" ? "Deleting…" : "Delete"}
            </Button>
          )}
          <Button
            onClick={() => run("archive", onArchive)}
            disabled={pending !== null}
          >
            {pending === "archive" ? "Archiving…" : "Archive"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
