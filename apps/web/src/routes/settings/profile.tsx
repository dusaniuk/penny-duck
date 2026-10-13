import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Input } from "@workspace/ui/components/input"
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import { Button } from "@workspace/ui/components/button"
import { Separator } from "@workspace/ui/components/separator"
import { toast } from "sonner"
import { api } from "@/lib/api"
import { CurrencyPicker } from "@/components/currency-picker"
import { DeleteAccountDialog } from "@/components/settings/delete-account-dialog"

export const Route = createFileRoute("/settings/profile")({
  component: ProfilePage,
})

function ProfilePage() {
  const { user } = Route.useRouteContext()
  const [name, setName] = useState(user.name)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const queryClient = useQueryClient()

  const [currency, setCurrency] = useState<string>(user.homeCurrency)

  const updateMutation = useMutation({
    mutationFn: async (body: { name?: string; homeCurrency?: string }) => {
      const res = await api.users.me.$patch({ json: body })
      if (!res.ok) throw await res.json()
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] })
      toast.success("Profile updated")
    },
    onError: () => {
      toast.error("Failed to update profile")
    },
  })

  function handleNameBlur() {
    const trimmed = name.trim()
    if (trimmed && trimmed !== user.name) {
      updateMutation.mutate({ name: trimmed })
    }
  }

  function handleCurrencyChange(code: string) {
    setCurrency(code)
    if (code && code !== user.homeCurrency) {
      updateMutation.mutate({ homeCurrency: code })
    }
  }

  function handleExport() {
    const a = document.createElement("a")
    a.href = "/api/users/me/export"
    a.download = "penny-duck-export.json"
    a.click()
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Profile</h2>
        <p className="text-base text-muted-foreground">
          Manage your name and preferences
        </p>
      </div>
      <FieldGroup className="gap-6">
        <Field>
          <FieldLabel>Name</FieldLabel>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleNameBlur}
            placeholder="Your name"
            maxLength={100}
          />
        </Field>

        <Field>
          <FieldLabel>Email</FieldLabel>
          <Input value={user.email} disabled />
          <p className="text-sm text-muted-foreground">
            Email cannot be changed
          </p>
        </Field>

        <Field>
          <FieldLabel>Home Currency</FieldLabel>
          <CurrencyPicker
            value={currency}
            onValueChange={handleCurrencyChange}
          />
        </Field>
      </FieldGroup>

      <Separator className="my-8" />

      <div className="mb-6">
        <h2 className="text-xl font-semibold">Your Data</h2>
        <p className="text-base text-muted-foreground">
          Download a copy of all your data
        </p>
      </div>
      <Button variant="outline" onClick={handleExport}>
        Download my data
      </Button>

      <Separator className="my-8" />

      <div className="mb-6">
        <h2 className="text-xl font-semibold text-destructive">Danger Zone</h2>
        <p className="text-base text-muted-foreground">
          Permanently delete your account and all data you own
        </p>
      </div>
      <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
        Delete account
      </Button>

      <DeleteAccountDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        userEmail={user.email}
      />
    </div>
  )
}
