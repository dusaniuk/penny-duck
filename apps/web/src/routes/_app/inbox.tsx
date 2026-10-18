import { useMemo } from "react"
import { Link, createFileRoute } from "@tanstack/react-router"
import { useMutation, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import type {
  AccountUsageItem,
  Category,
  CategoryUsageItem,
  InboxItem,
} from "@workspace/api-contract"
import type { AcceptInput } from "@/components/inbox/inbox-item-card"
import {
  InboxItemCard,
  inboxItemTitle,
} from "@/components/inbox/inbox-item-card"
import { api, queryClient, unwrap } from "@/lib/api"
import { flattenAccounts, walletsOf } from "@/lib/accounts"
import { PageHeader } from "@/components/page-header"
import { formatDateLabel } from "@/components/transactions/transaction-list"
import { errorMessage } from "@/lib/errors"

export const Route = createFileRoute("/_app/inbox")({
  staticData: { breadcrumb: "Inbox" },
  component: InboxPage,
})

function invalidateAfterChange() {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["inbox"] }),
    queryClient.invalidateQueries({ queryKey: ["transactions"] }),
    queryClient.invalidateQueries({ queryKey: ["accounts"] }),
    queryClient.invalidateQueries({ queryKey: ["stats"] }),
    queryClient.invalidateQueries({ queryKey: ["categories", "usage"] }),
  ])
}

const PENDING_KEY = ["inbox", "pending"]

// Accept and dismiss take the row off the list before the request returns; a
// failure refetches it back. Undo in the toast reverses either on the server.
async function hideFromList(id: string) {
  await queryClient.cancelQueries({ queryKey: PENDING_KEY })
  queryClient.setQueryData<{ data: Array<InboxItem> }>(PENDING_KEY, (old) =>
    old ? { ...old, data: old.data.filter((i) => i.id !== id) } : old
  )
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
    queryKey: PENDING_KEY,
    queryFn: () =>
      unwrap(
        api.inbox.$get({
          query: { status: "pending", limit: "100" },
        })
      ),
  })

  const { data: accountsData } = useQuery({
    queryKey: ["accounts"],
    queryFn: () => unwrap(api.accounts.$get()),
  })
  const accounts = useMemo(() => flattenAccounts(accountsData), [accountsData])
  const wallets = useMemo(() => walletsOf(accountsData), [accountsData])

  const { data: accountUsageData } = useQuery({
    queryKey: ["accounts", "usage"],
    queryFn: () => unwrap(api.accounts.usage.$get()),
  })
  const accountUsage: Array<AccountUsageItem> = accountUsageData ?? []

  const { data: categoriesData } = useQuery({
    queryKey: ["categories"],
    queryFn: () => unwrap(api.categories.$get()),
  })
  const categories: Array<Category> = categoriesData ?? []

  const { data: categoryUsageData } = useQuery({
    queryKey: ["categories", "usage"],
    queryFn: () => unwrap(api.categories.usage.$get()),
  })
  const categoryUsage: Array<CategoryUsageItem> = categoryUsageData ?? []

  const undoMutation = useMutation({
    mutationFn: (vars: { id: string; forgetCardLabel?: boolean }) =>
      unwrap(
        api.inbox[":id"].undo.$post({
          param: { id: vars.id },
          json: { forgetCardLabel: vars.forgetCardLabel },
        })
      ),
    onSuccess: async () => {
      await invalidateAfterChange()
      toast.success("Moved back to the inbox")
    },
    onError: (err) => toast.error(errorMessage(err, "Couldn't undo")),
  })

  const acceptMutation = useMutation({
    mutationFn: (vars: {
      item: InboxItem
      input: AcceptInput
      category: Category
    }) =>
      unwrap(
        api.inbox[":id"].accept.$post({
          param: { id: vars.item.id },
          json: vars.input,
        })
      ),
    onMutate: (vars) => hideFromList(vars.item.id),
    onSuccess: async (_res, { item, input, category }) => {
      await invalidateAfterChange()
      toast.success(`${inboxItemTitle(item)} filed under ${category.name}`, {
        action: {
          label: "Undo",
          onClick: () =>
            undoMutation.mutate({
              id: item.id,
              forgetCardLabel: input.saveCardLabel,
            }),
        },
      })
    },
    onError: (err) => {
      toast.error(errorMessage(err, "Couldn't accept this tap"))
      void queryClient.invalidateQueries({ queryKey: ["inbox"] })
    },
  })

  const dismissMutation = useMutation({
    mutationFn: (item: InboxItem) =>
      unwrap(api.inbox[":id"].dismiss.$post({ param: { id: item.id } })),
    onMutate: (item) => hideFromList(item.id),
    onSuccess: async (_res, item) => {
      await queryClient.invalidateQueries({ queryKey: ["inbox"] })
      toast(`${inboxItemTitle(item)} dismissed`, {
        action: {
          label: "Undo",
          onClick: () => undoMutation.mutate({ id: item.id }),
        },
      })
    },
    onError: (err) => {
      toast.error(errorMessage(err, "Couldn't dismiss this tap"))
      void queryClient.invalidateQueries({ queryKey: ["inbox"] })
    },
  })

  const items = data?.data ?? []
  const groups = groupByDay(items)

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Review"
        title="Inbox"
        description="Apple Pay taps sent from your phone. Pick a category to turn each one into a transaction."
      />

      {isLoading ? (
        <div className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2.5 px-3.5 py-3">
              <div className="flex items-center gap-3">
                <div className="size-9 shrink-0 animate-pulse rounded-[10px] bg-muted" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-32 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-48 animate-pulse rounded bg-muted" />
                </div>
                <div className="h-4 w-20 animate-pulse rounded bg-muted" />
              </div>
              <div className="h-6 w-72 max-w-full animate-pulse rounded-full bg-muted sm:ml-12" />
            </div>
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
            <section key={group.label} className="space-y-2">
              <div className="flex items-baseline justify-between px-0.5">
                <h2 className="text-[11px] font-semibold tracking-[0.06em] text-muted-foreground uppercase">
                  {group.label}
                </h2>
                <span className="text-xs text-muted-foreground">
                  {group.items.length === 1
                    ? "1 tap"
                    : `${group.items.length} taps`}
                </span>
              </div>
              <div className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
                {group.items.map((item) => (
                  <InboxItemCard
                    key={item.id}
                    item={item}
                    accounts={accounts}
                    wallets={wallets}
                    categories={categories}
                    categoryUsage={categoryUsage}
                    accountUsage={accountUsage}
                    onAccept={(it, input, category) =>
                      acceptMutation.mutate({ item: it, input, category })
                    }
                    onDismiss={(it) => dismissMutation.mutate(it)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
