import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { IconKey, IconPlus, IconTrash } from "@tabler/icons-react"
import { toast } from "sonner"
import { Button } from "@workspace/ui/components/button"
import { Separator } from "@workspace/ui/components/separator"
import { authClient } from "@/lib/auth-client"
import { ApiKeyCreateDialog } from "@/components/settings/api-key-create-dialog"
import { ApiKeyRevokeDialog } from "@/components/settings/api-key-revoke-dialog"
import { ShortcutRecipe } from "@/components/settings/shortcut-recipe"

export const Route = createFileRoute("/settings/shortcuts")({
  component: ShortcutsPage,
})

interface KeyRow {
  id: string
  name: string | null
  start: string | null
  createdAt: Date | string
  lastRequest: Date | string | null
}

function formatDate(value: Date | string | null): string {
  if (!value) return "never"
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function ShortcutsPage() {
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [revokeKey, setRevokeKey] = useState<KeyRow | null>(null)

  const {
    data: keys = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["api-keys"],
    queryFn: async () => {
      const res = await authClient.apiKey.list()
      if (res.error) throw new Error(res.error.message ?? "Failed to load keys")
      const rows = Array.isArray(res.data)
        ? res.data
        : (res.data?.apiKeys ?? [])
      return rows as Array<KeyRow>
    },
  })

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await authClient.apiKey.create({ name })
      if (res.error || !res.data) {
        throw new Error(res.error?.message ?? "Failed to create key")
      }
      return res.data.key
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["api-keys"] }),
  })

  const revokeMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const res = await authClient.apiKey.delete({ keyId })
      if (res.error)
        throw new Error(res.error.message ?? "Failed to revoke key")
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["api-keys"] })
      toast.success("Key revoked")
    },
    onError: (err) => toast.error(err.message),
  })

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Shortcuts</h2>
          <p className="text-base text-muted-foreground">
            Send Apple Pay taps from your iPhone into the Inbox
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <IconPlus />
          Create key
        </Button>
      </div>

      {isError ? (
        <p className="text-base text-destructive">
          Couldn't load your keys. Reload to try again.
        </p>
      ) : isLoading ? (
        <p className="text-base text-muted-foreground">Loading...</p>
      ) : keys.length === 0 ? (
        <p className="text-base text-muted-foreground">
          No keys yet. Create one, then follow the steps below.
        </p>
      ) : (
        <div className="divide-y">
          {keys.map((k) => (
            <div key={k.id} className="flex items-center gap-3 py-3">
              <IconKey className="size-5 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-medium">
                  {k.name ?? "Unnamed"}{" "}
                  {k.start && (
                    <span className="font-mono text-sm text-muted-foreground">
                      {k.start}…
                    </span>
                  )}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  Created {formatDate(k.createdAt)} · Last used{" "}
                  {formatDate(k.lastRequest)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Revoke ${k.name ?? "key"}`}
                onClick={() => setRevokeKey(k)}
              >
                <IconTrash className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Separator className="my-8" />

      <div className="mb-6">
        <h2 className="text-xl font-semibold">Set up the Shortcut</h2>
        <p className="text-base text-muted-foreground">
          One automation per phone, enabled for each card you want captured
        </p>
      </div>
      <ShortcutRecipe />

      <ApiKeyCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={(name) => createMutation.mutateAsync(name)}
      />
      {revokeKey && (
        <ApiKeyRevokeDialog
          open
          onOpenChange={(open) => !open && setRevokeKey(null)}
          keyName={revokeKey.name ?? "key"}
          onConfirm={() => revokeMutation.mutateAsync(revokeKey.id)}
        />
      )}
    </div>
  )
}
