import { useEffect, useState } from "react"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
import type { AccountData } from "@/components/accounts/account-card"

interface AccountDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: AccountData | null
  accounts: Array<AccountData>
  transactionCount: number
  onConfirm: (
    mode: "move" | "orphan" | "delete",
    targetAccountId?: string
  ) => Promise<void>
}

export function AccountDeleteDialog({
  open,
  onOpenChange,
  account,
  accounts,
  transactionCount,
  onConfirm,
}: AccountDeleteDialogProps) {
  const [loading, setLoading] = useState(false)
  const [targetAccountId, setTargetAccountId] = useState("")

  const otherAccounts = accounts.filter((a) => a.id !== account?.id)

  useEffect(() => {
    if (open) {
      setTargetAccountId("")
      setLoading(false)
    }
  }, [open])

  async function handleConfirm(mode: "move" | "orphan" | "delete") {
    setLoading(true)
    try {
      await onConfirm(mode, mode === "move" ? targetAccountId : undefined)
      onOpenChange(false)
    } finally {
      setLoading(false)
    }
  }

  if (transactionCount === 0) {
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
              onClick={() => handleConfirm("delete")}
              disabled={loading}
            >
              {loading ? "Deleting…" : "Delete"}
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
          This account has{" "}
          <span className="font-medium text-foreground">
            {transactionCount} transaction{transactionCount !== 1 ? "s" : ""}
          </span>
          . Choose what to do with them:
        </p>

        <div className="space-y-3 pt-2">
          {otherAccounts.length > 0 && (
            <div className="rounded-md border p-3">
              <p className="mb-2 text-sm font-medium">
                Move transactions to another account
              </p>
              <div className="flex gap-2">
                <Select
                  value={targetAccountId}
                  onValueChange={setTargetAccountId}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {otherAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name} ({a.currency})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={() => handleConfirm("move")}
                  disabled={loading || !targetAccountId}
                >
                  {loading ? "Moving…" : "Move & Delete"}
                </Button>
              </div>
            </div>
          )}

          <div className="rounded-md border p-3">
            <p className="mb-2 text-sm font-medium">
              Keep transactions without an account
            </p>
            <p className="mb-2 text-xs text-muted-foreground">
              Transactions will be marked as orphaned. You can reassign them
              later from the Transactions page.
            </p>
            <Button
              variant="outline"
              onClick={() => handleConfirm("orphan")}
              disabled={loading}
            >
              {loading ? "Processing…" : "Orphan & Delete"}
            </Button>
          </div>

          <div className="rounded-md border border-destructive/30 p-3">
            <p className="mb-2 text-sm font-medium text-destructive">
              Delete everything permanently
            </p>
            <p className="mb-2 text-xs text-muted-foreground">
              All transactions will be permanently deleted. This cannot be
              undone.
            </p>
            <Button
              variant="destructive"
              onClick={() => handleConfirm("delete")}
              disabled={loading}
            >
              {loading ? "Deleting…" : "Delete Everything"}
            </Button>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
