import { useState } from "react"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import type { AccountData } from "@/components/accounts/account-card"

interface AccountDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: AccountData | null
  transactionCount: number
  openPositionCount: number
  onConfirm: () => Promise<void>
}

export function AccountDeleteDialog({
  open,
  onOpenChange,
  account,
  transactionCount,
  openPositionCount,
  onConfirm,
}: AccountDeleteDialogProps) {
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

  if (openPositionCount > 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Cannot delete &ldquo;{account?.name}&rdquo;
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This account has{" "}
            <span className="font-medium text-foreground">
              {openPositionCount} open position
              {openPositionCount !== 1 ? "s" : ""}
            </span>{" "}
            and cannot be deleted. Sell or remove all positions first.
          </p>
          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  if (transactionCount > 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Cannot delete &ldquo;{account?.name}&rdquo;
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            This account has{" "}
            <span className="font-medium text-foreground">
              {transactionCount} transaction
              {transactionCount !== 1 ? "s" : ""}
            </span>{" "}
            and cannot be deleted. Remove all transactions first.
          </p>
          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete &ldquo;{account?.name}&rdquo;?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          This account has no transactions. It will be permanently deleted.
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
            {loading ? "Deleting\u2026" : "Delete"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
