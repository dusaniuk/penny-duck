import { useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog"
import { Input } from "@workspace/ui/components/input"
import { Field, FieldLabel } from "@workspace/ui/components/field"
import { toast } from "sonner"
import { tsr } from "@/lib/api"

interface DeleteAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userEmail: string
}

export function DeleteAccountDialog({
  open,
  onOpenChange,
  userEmail,
}: DeleteAccountDialogProps) {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const deleteMutation = tsr.users.deleteMe.useMutation()

  async function handleDelete() {
    setLoading(true)
    try {
      await deleteMutation.mutateAsync({ body: { email } })
      toast.success("Account deleted")
      navigate({ to: "/login" })
    } catch {
      toast.error("Failed to delete account")
      setLoading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setEmail("")
        onOpenChange(v)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete your account</DialogTitle>
          <DialogDescription>
            This will permanently delete your account and all organizations you
            own, including all their accounts, categories, and transactions.
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel>
            Type <span className="font-mono font-semibold">{userEmail}</span> to
            confirm
          </FieldLabel>
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={userEmail}
          />
        </Field>
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
            onClick={handleDelete}
            disabled={email !== userEmail || loading}
          >
            {loading ? "Deleting\u2026" : "Delete my account"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
