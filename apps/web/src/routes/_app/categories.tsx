import { useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import type { CategoryData } from "@/components/categories/category-row"
import { CategoryList } from "@/components/categories/category-list"
import { CategoryDeleteDialog } from "@/components/categories/category-delete-dialog"
import { queryClient, tsr } from "@/lib/api"

export const Route = createFileRoute("/_app/categories")({
  staticData: { breadcrumb: "Categories" },
  component: CategoriesPage,
})

function CategoriesPage() {
  const { data, isLoading: loading } =
    tsr.categories.list.useQuery({ queryKey: ["categories"] })
  const categories = data?.body ?? []

  const [deleteCategory, setDeleteCategory] = useState<CategoryData | null>(
    null
  )

  const updateMutation = tsr.categories.update.useMutation({
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["categories"] }),
  })

  const createMutation = tsr.categories.create.useMutation({
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["categories"] }),
  })

  const deleteMutation = tsr.categories.delete.useMutation({
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["categories"] }),
  })

  async function handleEdit(
    id: string,
    formData: { name: string; icon?: string }
  ) {
    await updateMutation.mutateAsync({
      params: { id },
      body: formData,
    })
  }

  async function handleCreate(formData: {
    name: string
    icon?: string
    parentId: string | null
  }) {
    await createMutation.mutateAsync({
      body: {
        name: formData.name,
        icon: formData.icon,
        parentId: formData.parentId ?? undefined,
      },
    })
  }

  async function handleDelete() {
    if (!deleteCategory) return
    await deleteMutation.mutateAsync({ params: { id: deleteCategory.id } })
  }

  return (
    <div className="space-y-6">
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
        <CategoryList
          categories={categories}
          onEdit={handleEdit}
          onCreate={handleCreate}
          onDelete={setDeleteCategory}
        />
      )}

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
