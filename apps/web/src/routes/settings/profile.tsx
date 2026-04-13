import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useQueryClient } from "@tanstack/react-query"
import { Input } from "@workspace/ui/components/input"
import { Field, FieldGroup, FieldLabel } from "@workspace/ui/components/field"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@workspace/ui/components/combobox"
import { Button } from "@workspace/ui/components/button"
import { Separator } from "@workspace/ui/components/separator"
import { CURRENCIES } from "@workspace/shared/currencies"
import { toast } from "sonner"
import { tsr } from "@/lib/api"
import { DeleteAccountDialog } from "@/components/settings/delete-account-dialog"

const currencyItems = CURRENCIES.map((c) => ({
  ...c,
  label: `${c.code} — ${c.name}`,
}))

type CurrencyItem = (typeof currencyItems)[number]

export const Route = createFileRoute("/settings/profile")({
  component: ProfilePage,
})

function ProfilePage() {
  const { user } = Route.useRouteContext()
  const [name, setName] = useState(user.name)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const queryClient = useQueryClient()

  const [currency, setCurrency] = useState<CurrencyItem | null>(
    currencyItems.find((c) => c.code === user.homeCurrency) ?? null
  )

  const updateMutation = tsr.users.updateMe.useMutation({
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
      updateMutation.mutate({ body: { name: trimmed } })
    }
  }

  function handleCurrencyChange(item: CurrencyItem | null) {
    setCurrency(item)
    if (item && item.code !== user.homeCurrency) {
      updateMutation.mutate({ body: { homeCurrency: item.code } })
    }
  }

  function handleExport() {
    const a = document.createElement("a")
    a.href = "/api/users/me/export"
    a.download = "penny-duck-export.json"
    a.click()
  }

  return (
    <div className="max-w-2xl">
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
          <Combobox
            items={currencyItems}
            itemToStringValue={(item) => item.label}
            value={currency}
            onValueChange={handleCurrencyChange}
          >
            <ComboboxInput placeholder="Search currency..." />
            <ComboboxContent>
              <ComboboxEmpty>No currency found.</ComboboxEmpty>
              <ComboboxList>
                {(item) => (
                  <ComboboxItem key={item.code} value={item}>
                    {item.label}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
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
