import { useMemo, useState } from "react"
import { createFileRoute, getRouteApi } from "@tanstack/react-router"
import { useMutation, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { Tabs, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import type { InferRequestType } from "hono/client"
import type { Category, CategoryType } from "@workspace/api-contract"
import type { CategorySubmitData } from "@/components/categories/category-form-dialog"
import type { ParentRollup } from "@/components/categories/category-stats"
import type { CategoryDialogMode } from "@/components/categories/category-archive-dialog"
import { CategoryArchiveDialog } from "@/components/categories/category-archive-dialog"
import { CategoryDetail } from "@/components/categories/category-detail"
import { CategoryEmptyState } from "@/components/categories/category-empty-state"
import { CategoryFormDialog } from "@/components/categories/category-form-dialog"
import { CategorySidebar } from "@/components/categories/category-sidebar"
import {
  buildStatsMap,
  rollupParent,
  statFor,
} from "@/components/categories/category-stats"
import { PageHeader } from "@/components/page-header"
import { api, queryClient } from "@/lib/api"
import { activeCategories, isArchivedCategory } from "@/lib/categories"
import { errorMessage } from "@/lib/errors"

type CreateCategoryBody = InferRequestType<typeof api.categories.$post>["json"]
type UpdateCategoryBody = InferRequestType<
  (typeof api.categories)[":id"]["$patch"]
>["json"]

const appRouteApi = getRouteApi("/_app")

const TYPE_TABS: ReadonlyArray<{ value: CategoryType | "all"; label: string }> =
  [
    { value: "expense", label: "Expenses" },
    { value: "income", label: "Income" },
    { value: "all", label: "All" },
  ]

export const Route = createFileRoute("/_app/categories")({
  staticData: { breadcrumb: "Categories" },
  component: CategoriesPage,
})

function invalidateCategories() {
  return queryClient.invalidateQueries({ queryKey: ["categories"] })
}

function CategoriesPage() {
  const { user } = appRouteApi.useRouteContext()

  const { data, isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await api.categories.$get()
      if (!res.ok) throw await res.json()
      return res.json()
    },
  })

  const categories = useMemo<Array<Category>>(() => data ?? [], [data])
  // Tabs, counts and the parent picker see live parents only; archived
  // parents get their own collapsed group in the sidebar.
  const topLevel = useMemo(
    () => activeCategories(categories).filter((c) => c.parentId === null),
    [categories]
  )
  const archivedTopLevel = useMemo(
    () =>
      categories.filter((c) => c.parentId === null && isArchivedCategory(c)),
    [categories]
  )

  const { data: usageData } = useQuery({
    queryKey: ["categories", "usage"],
    queryFn: async () => {
      const res = await api.categories.usage.$get()
      if (!res.ok) throw await res.json()
      return res.json()
    },
  })

  const statsMap = useMemo(() => buildStatsMap(usageData), [usageData])

  // Children grouped under their parent, alphabetised.
  const childrenByParent = useMemo(() => {
    const map = new Map<string, Array<Category>>()
    for (const c of categories) {
      if (c.parentId === null) continue
      const arr = map.get(c.parentId)
      if (arr) arr.push(c)
      else map.set(c.parentId, [c])
    }
    for (const arr of map.values())
      arr.sort((a, b) => a.name.localeCompare(b.name))
    return map
  }, [categories])

  const parentRollups = useMemo(() => {
    const map = new Map<string, ParentRollup>()
    for (const p of [...topLevel, ...archivedTopLevel])
      map.set(
        p.id,
        rollupParent(p.id, childrenByParent.get(p.id) ?? [], statsMap)
      )
    return map
  }, [topLevel, archivedTopLevel, childrenByParent, statsMap])

  const tabCounts = useMemo(
    () => ({
      expense: topLevel.filter((p) => p.type === "expense").length,
      income: topLevel.filter((p) => p.type === "income").length,
      all: topLevel.length,
    }),
    [topLevel]
  )

  const [activeType, setActiveType] = useState<CategoryType | "all">("expense")
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null)

  // Parents in the active tab, biggest spenders first.
  const visibleParents = useMemo(() => {
    return topLevel
      .filter((p) => activeType === "all" || p.type === activeType)
      .sort((a, b) => {
        const sa = parentRollups.get(a.id)?.spentThisMonth ?? 0
        const sb = parentRollups.get(b.id)?.spentThisMonth ?? 0
        return sb - sa || a.name.localeCompare(b.name)
      })
  }, [topLevel, activeType, parentRollups])

  const visibleArchivedParents = useMemo(
    () =>
      archivedTopLevel
        .filter((p) => activeType === "all" || p.type === activeType)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [archivedTopLevel, activeType]
  )

  const totalSpent = useMemo(
    () =>
      visibleParents.reduce(
        (sum, p) => sum + (parentRollups.get(p.id)?.spentThisMonth ?? 0),
        0
      ),
    [visibleParents, parentRollups]
  )

  // Resolve the selection against the current tab so switching tabs (or
  // deleting the selected parent) always lands on a visible category.
  const selectedParent =
    visibleParents.find((p) => p.id === selectedParentId) ??
    visibleArchivedParents.find((p) => p.id === selectedParentId) ??
    visibleParents[0] ??
    null

  const [formOpen, setFormOpen] = useState(false)
  const [editCategory, setEditCategory] = useState<Category | null>(null)
  const [createParentId, setCreateParentId] = useState<string | null>(null)
  const [dialogCategory, setDialogCategory] = useState<Category | null>(null)
  const [dialogMode, setDialogMode] = useState<CategoryDialogMode>("archive")

  const createMutation = useMutation({
    mutationFn: async (body: CreateCategoryBody) => {
      const res = await api.categories.$post({ json: body })
      if (!res.ok) throw await res.json()
      return res.json()
    },
    onSuccess: invalidateCategories,
  })

  const updateMutation = useMutation({
    mutationFn: async (vars: { id: string; body: UpdateCategoryBody }) => {
      const res = await api.categories[":id"].$patch({
        param: { id: vars.id },
        json: vars.body,
      })
      if (!res.ok) throw await res.json()
      return res.json()
    },
    onSuccess: invalidateCategories,
  })

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.categories[":id"].$delete({ param: { id } })
      if (!res.ok) throw await res.json()
      return res.json()
    },
    onSuccess: invalidateCategories,
  })

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.categories[":id"].archive.$put({ param: { id } })
      if (!res.ok) throw await res.json()
      return res.json()
    },
    onSuccess: invalidateCategories,
  })

  const unarchiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.categories[":id"].archive.$delete({
        param: { id },
      })
      if (!res.ok) throw await res.json()
      return res.json()
    },
    onSuccess: invalidateCategories,
  })

  const seedMutation = useMutation({
    mutationFn: async () => {
      const res = await api.categories.seed.$post()
      if (!res.ok) throw await res.json()
      return res.json()
    },
    onSuccess: invalidateCategories,
  })

  function handleOpenCreate() {
    setEditCategory(null)
    setCreateParentId(null)
    setFormOpen(true)
  }

  function handleAddChild(parent: Category) {
    setEditCategory(null)
    setCreateParentId(parent.id)
    setFormOpen(true)
  }

  function handleEdit(category: Category) {
    setCreateParentId(null)
    setEditCategory(category)
    setFormOpen(true)
  }

  async function handleSubmit(input: CategorySubmitData) {
    const isChild = input.parentId !== null
    if (input.id) {
      await updateMutation.mutateAsync({
        id: input.id,
        body: isChild
          ? { name: input.name, icon: input.icon }
          : {
              name: input.name,
              color: input.color ?? undefined,
              icon: input.icon,
            },
      })
    } else {
      await createMutation.mutateAsync(
        isChild
          ? {
              name: input.name,
              parentId: input.parentId ?? undefined,
              icon: input.icon ?? undefined,
            }
          : {
              name: input.name,
              type: input.type,
              color: input.color ?? undefined,
              icon: input.icon ?? undefined,
            }
      )
    }
  }

  function handleOpenArchive(category: Category) {
    setDialogMode("archive")
    setDialogCategory(category)
  }

  function handleOpenDelete(category: Category) {
    setDialogMode("delete")
    setDialogCategory(category)
  }

  async function handleArchive() {
    if (!dialogCategory) return
    try {
      await archiveMutation.mutateAsync(dialogCategory.id)
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't archive the category"))
      throw err
    }
  }

  async function handleUnarchive(category: Category) {
    try {
      await unarchiveMutation.mutateAsync(category.id)
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't unarchive the category"))
    }
  }

  async function handleDelete() {
    if (!dialogCategory) return
    try {
      await deleteMutation.mutateAsync(dialogCategory.id)
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't delete the category"))
      throw err
    }
  }

  async function handleUseDefaults() {
    try {
      await seedMutation.mutateAsync()
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't set up the default categories"))
    }
  }

  const dialogInfo = useMemo(() => {
    if (!dialogCategory) return { childCount: 0, transactionCount: 0 }
    const childIds = categories
      .filter((c) => c.parentId === dialogCategory.id)
      .map((c) => c.id)
    const ids = [dialogCategory.id, ...childIds]
    const transactionCount = ids.reduce(
      (sum, id) => sum + statFor(statsMap, id).count,
      0
    )
    return { childCount: childIds.length, transactionCount }
  }, [dialogCategory, categories, statsMap])

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Categories"
        title="Tag your money"
        description="Group transactions under the labels that mean something to you."
      />

      {isLoading ? (
        <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
          <div className="h-72 animate-pulse rounded-2xl bg-muted" />
          <div className="h-72 animate-pulse rounded-2xl bg-muted" />
        </div>
      ) : categories.length === 0 ? (
        <CategoryEmptyState
          onUseDefaults={handleUseDefaults}
          onCreateFirst={handleOpenCreate}
          isSeeding={seedMutation.isPending}
        />
      ) : (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Tabs
              value={activeType}
              onValueChange={(v) => setActiveType(v as CategoryType | "all")}
            >
              <TabsList>
                {TYPE_TABS.map((tab) => (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="px-3 py-1.5 text-[13px]"
                  >
                    {tab.label}
                    <span className="ml-1.5 grid min-w-4 place-items-center rounded-full bg-foreground/8 px-1 text-[10px] font-semibold tabular-nums">
                      {tabCounts[tab.value]}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <p className="hidden text-xs text-muted-foreground sm:block">
              Children inherit shades from their parent&rsquo;s colour.
            </p>
          </div>

          <div className="grid gap-5 lg:grid-cols-[320px_1fr] lg:items-start">
            <CategorySidebar
              parents={visibleParents}
              archivedParents={visibleArchivedParents}
              childrenByParent={childrenByParent}
              stats={statsMap}
              totalSpent={totalSpent}
              selectedId={selectedParent?.id ?? null}
              onSelect={setSelectedParentId}
              onCreateParent={handleOpenCreate}
            />

            {selectedParent ? (
              <CategoryDetail
                key={selectedParent.id}
                parent={selectedParent}
                children={childrenByParent.get(selectedParent.id) ?? []}
                stats={statsMap}
                totalSpent={totalSpent}
                homeCurrency={user.homeCurrency}
                onEdit={handleEdit}
                onArchive={handleOpenArchive}
                onUnarchive={handleUnarchive}
                onDelete={handleOpenDelete}
                onAddChild={handleAddChild}
              />
            ) : (
              <div className="grid place-items-center rounded-2xl border border-dashed border-border px-6 py-16 text-center text-sm text-muted-foreground">
                No {activeType === "all" ? "" : activeType} categories yet — add
                a parent to get started.
              </div>
            )}
          </div>
        </div>
      )}

      <CategoryFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        category={editCategory}
        parents={topLevel}
        initialParentId={createParentId}
        initialType={activeType === "income" ? "income" : "expense"}
        existingColors={topLevel.map((c) => c.color)}
        existingIcons={categories.map((c) => c.icon)}
        onSubmit={handleSubmit}
      />

      <CategoryArchiveDialog
        open={!!dialogCategory}
        onOpenChange={(open) => {
          if (!open) setDialogCategory(null)
        }}
        category={dialogCategory}
        mode={dialogMode}
        childCount={dialogInfo.childCount}
        transactionCount={dialogInfo.transactionCount}
        onArchive={handleArchive}
        onDelete={handleDelete}
      />
    </div>
  )
}
