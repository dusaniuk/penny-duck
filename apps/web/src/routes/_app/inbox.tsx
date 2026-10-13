import { useMemo } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { useMutation, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import type { Category, InboxItem } from "@workspace/api-contract"
import type { AcceptInput } from "@/components/inbox/inbox-item-card"
import { api, queryClient } from "@/lib/api"
import { flattenAccounts } from "@/lib/accounts"
import { PageHeader } from "@/components/page-header"
import { InboxItemCard } from "@/components/inbox/inbox-item-card"
import { formatDateLabel } from "@/components/transactions/transaction-list"

export const Route = createFileRoute("/_app/inbox")({
  staticData: { breadcrumb: "Inbox" },
  component: InboxPage,
})

function errorMessage(err: unknown, fallback: string): string {
  if (
    err &&
    typeof err === "object" &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string"
  ) {
    return (err as { message: string }).message
  }
  return fallback
}

function invalidateAfterChange() {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["inbox"] }),
    queryClient.invalidateQueries({ queryKey: ["transactions"] }),
    queryClient.invalidateQueries({ queryKey: ["accounts"] }),
    queryClient.invalidateQueries({ queryKey: ["stats"] }),
  ])
}

function groupByDay(items: Array<InboxItem>) {
  const groups = new Map<string, Array<InboxItem>>()
  for (const item of items) {
    const key = new Date(item.occurredAt).toLocaleDateString("en-CA")
    const list = groups.get(key) ?? []
    list.push(item)
    groups.set(key, list)
  }
  return Array.from(groups.values()).map((list) => ({
    label: formatDateLabel(list[0].occurredAt),
    items: list,
  }))
}

function InboxPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["inbox", "pending"],
    queryFn: async () => {
      const res = await api.inbox.$get({
        query: { status: "pending", limit: "100" },
      })
      if (!res.ok) throw await res.json()
      return res.json()
    },
  })

  const { data: accountsData } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const res = await api.accounts.$get()
      if (!res.ok) throw await res.json()
      return res.json()
    },
  })
  const accounts = useMemo(() => flattenAccounts(accountsData), [accountsData])

  const { data: categoriesData } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await api.categories.$get()
      if (!res.ok) throw await res.json()
      return res.json()
    },
  })
  const categories: Array<Category> = categoriesData ?? []

  const acceptMutation = useMutation({
    mutationFn: async (vars: { id: string; input: AcceptInput }) => {
      const res = await api.inbox[":id"].accept.$post({
        param: { id: vars.id },
        json: vars.input,
      })
      if (!res.ok) throw await res.json()
      return res.json()
    },
    onSuccess: async () => {
      await invalidateAfterChange()
      toast.success("Added to transactions")
    },
    onError: (err) => {
      toast.error(errorMessage(err, "Couldn't accept this tap"))
      void queryClient.invalidateQueries({ queryKey: ["inbox"] })
    },
  })

  const dismissMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.inbox[":id"].dismiss.$post({ param: { id } })
      if (!res.ok) throw await res.json()
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["inbox"] }),
    onError: (err) => {
      toast.error(errorMessage(err, "Couldn't dismiss this tap"))
      void queryClient.invalidateQueries({ queryKey: ["inbox"] })
    },
  })

  const items = data?.data ?? []
  const groups = groupByDay(items)
  const busy = acceptMutation.isPending || dismissMutation.isPending

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Review"
        title="Inbox"
        description="Apple Pay taps sent from your phone. Pick a category to turn each one into a transaction."
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
          <p className="text-base">Nothing to review</p>
          <p className="mt-1 max-w-sm text-sm">
            Taps appear here once your iPhone Shortcut is set up.{" "}
            <Link to="/settings/shortcuts" className="text-primary underline">
              Set up the Shortcut
            </Link>
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.label} className="space-y-2">
              <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">
                {group.label}
              </p>
              {group.items.map((item) => (
                <InboxItemCard
                  key={item.id}
                  item={item}
                  accounts={accounts}
                  categories={categories}
                  busy={busy}
                  onAccept={(it, input) =>
                    acceptMutation.mutate({ id: it.id, input })
                  }
                  onDismiss={(it) => dismissMutation.mutate(it.id)}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
