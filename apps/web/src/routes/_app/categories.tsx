import { useMemo, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import { useMutation, useQuery } from "@tanstack/react-query"
import type { Category, CategoryType } from "@workspace/api-contract"
import type { CategoryDialogMode } from "@/components/categories/category-form-dialog"
import type { CategoryColor } from "@/lib/category-color"
import { CategoryFormDialog } from "@/components/categories/category-form-dialog"
import { CategoryList } from "@/components/categories/category-list"
import { CategoryDeleteDialog } from "@/components/categories/category-delete-dialog"
import { api, queryClient } from "@/lib/api"

export const Route = createFileRoute("/_app/categories")({
  staticData: { breadcrumb: "Categories" },
  component: CategoriesPage,
})

function CategoriesPage() {
  const { data, isLoading: loading } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await api.categories.$get()
      if (!res.ok) throw await res.json()
      return res.json()
    },
  })
  const categories = data ?? []

  const { expenseCategories, incomeCategories } = useMemo(() => {
    const expense: Array<Category> = []
    const income: Array<Category> = []
    for (const c of categories) {
      if (c.type === "income") income.push(c)
      else expense.push(c)
    }
    return { expenseCategories: expense, incomeCategories: income }
  }, [categories])

  const parentOptionsByType = useMemo(() => {
    const expense = categories.filter(
      (c) => c.parentId === null && c.type === "expense"
    )
    const income = categories.filter(
      (c) => c.parentId === null && c.type === "income"
    )
    return { expense, income }
  }, [categories])

  const existingTopLevelColors = useMemo(
    () => categories.filter((c) => c.parentId === null).map((c) => c.color),
    [categories]
  )

  function getHasChildren(category: Category): boolean {
    return categories.some((c) => c.parentId === category.id)
  }

  const [dialogMode, setDialogMode] = useState<CategoryDialogMode | null>(null)
  const [deleteCategory, setDeleteCategory] = useState<Category | null>(null)

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["categories"] })

  const createMutation = useMutation({
    mutationFn: async (body: {
      name: string
      icon?: string
      type?: CategoryType
      parentId?: string
      color?: CategoryColor
    }) => {
      const res = await api.categories.$post({ json: body })
      if (!res.ok) throw await res.json()
      return res.json()
    },
    onSuccess: invalidate,
  })
  const updateMutation = useMutation({
    mutationFn: async (vars: {
      id: string
      body: {
        name?: string
        icon?: string
        type?: CategoryType
        parentId?: string | null
        color?: CategoryColor
      }
    }) => {
      const res = await api.categories[":id"].$patch({
        param: { id: vars.id },
        json: vars.body,
      })
      if (!res.ok) throw await res.json()
      return res.json()
    },
    onSuccess: invalidate,
  })
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.categories[":id"].$delete({ param: { id } })
      if (!res.ok) throw await res.json()
      return res.json()
    },
    onSuccess: invalidate,
  })

  function openCreateParent(type: CategoryType) {
    setDialogMode({ kind: "create-parent", type })
  }

  function openCreateChild(parent: Category) {
    setDialogMode({ kind: "create-child", parent })
  }

  function openEdit(category: Category, isParent: boolean) {
    setDialogMode({ kind: "edit", category, isParent })
  }

  async function handleDialogSubmit(form: {
    name: string
    icon?: string
    type?: CategoryType
    parentId?: string | null
    color?: CategoryColor
  }) {
    if (!dialogMode) return
    switch (dialogMode.kind) {
      case "create-parent":
        await createMutation.mutateAsync({
          name: form.name,
          icon: form.icon,
          type: dialogMode.type,
          ...(form.color ? { color: form.color } : {}),
        })
        break
      case "create-child":
        await createMutation.mutateAsync({
          name: form.name,
          icon: form.icon,
          parentId: dialogMode.parent.id,
        })
        break
      case "edit":
        await updateMutation.mutateAsync({
          id: dialogMode.category.id,
          body: {
            name: form.name,
            icon: form.icon,
            ...(form.type !== undefined ? { type: form.type } : {}),
            ...(form.parentId !== undefined ? { parentId: form.parentId } : {}),
            ...(form.color ? { color: form.color } : {}),
          },
        })
        break
    }
    setDialogMode(null)
  }

  async function handleDelete() {
    if (!deleteCategory) return
    await deleteMutation.mutateAsync(deleteCategory.id)
  }

  const dialogParentOptions =
    dialogMode?.kind === "edit"
      ? parentOptionsByType[dialogMode.category.type]
      : []

  const dialogHasChildren =
    dialogMode?.kind === "edit" ? getHasChildren(dialogMode.category) : false

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-semibold">Categories</h1>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-[48px] animate-pulse rounded-lg bg-muted"
            />
          ))}
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold">Expenses</h2>
            <CategoryList
              type="expense"
              categories={expenseCategories}
              onAddParent={() => openCreateParent("expense")}
              onAddChild={openCreateChild}
              onEdit={openEdit}
              onDelete={setDeleteCategory}
              allCategories={categories}
            />
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-lg font-semibold">Income</h2>
            <CategoryList
              type="income"
              categories={incomeCategories}
              onAddParent={() => openCreateParent("income")}
              onAddChild={openCreateChild}
              onEdit={openEdit}
              onDelete={setDeleteCategory}
              allCategories={categories}
            />
          </section>
        </>
      )}

      <CategoryFormDialog
        open={dialogMode !== null}
        onOpenChange={(open) => {
          if (!open) setDialogMode(null)
        }}
        mode={dialogMode}
        parentOptions={dialogParentOptions}
        hasChildren={dialogHasChildren}
        existingTopLevelColors={existingTopLevelColors}
        onSubmit={handleDialogSubmit}
      />

      <CategoryDeleteDialog
        open={!!deleteCategory}
        onOpenChange={(open) => {
          if (!open) setDeleteCategory(null)
        }}
        category={deleteCategory}
        isParent={deleteCategory?.parentId === null}
        onConfirm={handleDelete}
      />
    </div>
  )
}
