import { useMemo, useState } from "react"
import { IconPlus } from "@tabler/icons-react"
import { createFileRoute } from "@tanstack/react-router"
import { useMutation, useQuery } from "@tanstack/react-query"
import { toast } from "sonner"
import { Button } from "@workspace/ui/components/button"
import type { InferRequestType } from "hono/client"
import type { Category } from "@workspace/api-contract"
import type { CategorySubmitData } from "@/components/categories/category-form-dialog"
import { CategoryDeleteDialog } from "@/components/categories/category-delete-dialog"
import { CategoryEmptyState } from "@/components/categories/category-empty-state"
import { CategoryFormDialog } from "@/components/categories/category-form-dialog"
import { CategoryList } from "@/components/categories/category-list"
import { PageHeader } from "@/components/page-header"
import { api, queryClient } from "@/lib/api"

type CreateCategoryBody = InferRequestType<typeof api.categories.$post>["json"]
type UpdateCategoryBody = InferRequestType<
  (typeof api.categories)[":id"]["$patch"]
>["json"]

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

export const Route = createFileRoute("/_app/categories")({
  staticData: { breadcrumb: "Categories" },
  component: CategoriesPage,
})

function invalidateCategories() {
  return queryClient.invalidateQueries({ queryKey: ["categories"] })
}

function CategoriesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await api.categories.$get()
      if (!res.ok) throw await res.json()
      return res.json()
    },
  })

  const categories = useMemo<Array<Category>>(() => data ?? [], [data])
  const topLevel = useMemo(
    () => categories.filter((c) => c.parentId === null),
    [categories]
  )

  // Transaction counts per category — drives the delete-dialog warning copy.
  const { data: usageData } = useQuery({
    queryKey: ["categories", "usage"],
    queryFn: async () => {
      const res = await api.categories.usage.$get()
      if (!res.ok) throw await res.json()
      return res.json()
    },
  })

  const usageMap = useMemo(() => {
    const m = new Map<string, number>()
    for (const u of usageData ?? []) m.set(u.categoryId, u.count)
    return m
  }, [usageData])

  const [formOpen, setFormOpen] = useState(false)
  const [editCategory, setEditCategory] = useState<Category | null>(null)
  const [createParentId, setCreateParentId] = useState<string | null>(null)
  const [deleteCategory, setDeleteCategory] = useState<Category | null>(null)

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

  async function handleDelete() {
    if (!deleteCategory) return
    try {
      await deleteMutation.mutateAsync(deleteCategory.id)
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't delete the category"))
    }
  }

  async function handleUseDefaults() {
    try {
      await seedMutation.mutateAsync()
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't set up the default categories"))
    }
  }

  const deleteInfo = useMemo(() => {
    if (!deleteCategory) return { childCount: 0, transactionCount: 0 }
    const childIds = categories
      .filter((c) => c.parentId === deleteCategory.id)
      .map((c) => c.id)
    const ids = [deleteCategory.id, ...childIds]
    const transactionCount = ids.reduce(
      (sum, id) => sum + (usageMap.get(id) ?? 0),
      0
    )
    return { childCount: childIds.length, transactionCount }
  }, [deleteCategory, categories, usageMap])

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Categories"
        title="Tag your money"
        description="Group transactions under the labels that mean something to you."
        action={
          <Button type="button" onClick={handleOpenCreate}>
            <IconPlus />
            New category
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-1.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-[52px] animate-pulse rounded-[11px] bg-muted"
            />
          ))}
        </div>
      ) : categories.length === 0 ? (
        <CategoryEmptyState
          onUseDefaults={handleUseDefaults}
          onCreateFirst={handleOpenCreate}
          isSeeding={seedMutation.isPending}
        />
      ) : (
        <CategoryList
          categories={categories}
          onEdit={handleEdit}
          onDelete={setDeleteCategory}
          onAddChild={handleAddChild}
        />
      )}

      <CategoryFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        category={editCategory}
        parents={topLevel}
        initialParentId={createParentId}
        existingColors={topLevel.map((c) => c.color)}
        existingIcons={categories.map((c) => c.icon)}
        onSubmit={handleSubmit}
      />

      <CategoryDeleteDialog
        open={!!deleteCategory}
        onOpenChange={(open) => {
          if (!open) setDeleteCategory(null)
        }}
        category={deleteCategory}
        childCount={deleteInfo.childCount}
        transactionCount={deleteInfo.transactionCount}
        onConfirm={handleDelete}
      />
    </div>
  )
}
