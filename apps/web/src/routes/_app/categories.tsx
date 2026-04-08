import { useEffect, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import type { CategoryData } from "@/components/categories/category-row"
import { CategoryList } from "@/components/categories/category-list"
import { CategoryDeleteDialog } from "@/components/categories/category-delete-dialog"
import { api } from "@/lib/api"

export const Route = createFileRoute("/_app/categories")({
  component: CategoriesPage,
})

function CategoriesPage() {
  const [categories, setCategories] = useState<Array<CategoryData>>([])
  const [loading, setLoading] = useState(true)
  const [deleteCategory, setDeleteCategory] = useState<CategoryData | null>(
    null
  )

  async function refetch() {
    const res = await api.get("/categories")
    const data = await res.json()
    setCategories(data)
  }

  useEffect(() => {
    api
      .get("/categories")
      .then((res) => res.json())
      .then((data) => setCategories(data))
      .catch(() => setCategories([]))
      .finally(() => setLoading(false))
  }, [])

  async function handleEdit(
    id: string,
    data: { name: string; icon?: string }
  ) {
    const res = await api.patch(`/categories/${id}`, data)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body?.message ?? "Request failed")
    }
    await refetch()
  }

  async function handleCreate(data: {
    name: string
    icon?: string
    parentId: string | null
  }) {
    const res = await api.post("/categories", data)
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body?.message ?? "Request failed")
    }
    await refetch()
  }

  async function handleDelete() {
    if (!deleteCategory) return
    await api.del(`/categories/${deleteCategory.id}`)
    await refetch()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl font-semibold">Categories</h1>
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
