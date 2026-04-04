import { useEffect, useState } from "react"
import { createFileRoute } from "@tanstack/react-router"
import type { CategoryData } from "@/components/categories/category-card"
import { api } from "@/lib/api"
import {
  AddCategoryCard,
  CategoryCard,
} from "@/components/categories/category-card"
import { CategoryFormDialog } from "@/components/categories/category-form-dialog"
import { CategoryDeleteDialog } from "@/components/categories/category-delete-dialog"

export const Route = createFileRoute("/_app/categories")({
  component: CategoriesPage,
})

function CategoriesPage() {
  const [categories, setCategories] = useState<Array<CategoryData>>([])
  const [loading, setLoading] = useState(true)

  const [formOpen, setFormOpen] = useState(false)
  const [editCategory, setEditCategory] = useState<CategoryData | null>(null)
  const [addParentId, setAddParentId] = useState<string | null>(null)
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

  function handleOpenCreateParent() {
    setEditCategory(null)
    setAddParentId(null)
    setFormOpen(true)
  }

  function handleAddChild(parentId: string) {
    setEditCategory(null)
    setAddParentId(parentId)
    setFormOpen(true)
  }

  function handleEdit(category: CategoryData) {
    setEditCategory(category)
    setAddParentId(null)
    setFormOpen(true)
  }

  async function handleFormSubmit(data: {
    name: string
    icon?: string
    parentId?: string | null
  }) {
    let res: Response
    if (editCategory) {
      res = await api.patch(`/categories/${editCategory.id}`, data)
    } else {
      res = await api.post("/categories", data)
    }

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

  const parents = categories.filter((c) => c.parentId === null)
  const childrenByParentId = categories.reduce<
    Record<string, Array<CategoryData>>
  >((acc, c) => {
    if (c.parentId !== null) {
      acc[c.parentId] = [...(acc[c.parentId] ?? []), c]
    }
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-xl font-semibold">Categories</h1>
      </div>

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-[120px] animate-pulse rounded-lg bg-muted"
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {parents.map((parent) => (
            <CategoryCard
              key={parent.id}
              parent={parent}
              children={childrenByParentId[parent.id] ?? []}
              onEditParent={handleEdit}
              onDeleteParent={setDeleteCategory}
              onEditChild={handleEdit}
              onDeleteChild={setDeleteCategory}
              onAddChild={handleAddChild}
            />
          ))}
          <AddCategoryCard onClick={handleOpenCreateParent} />
        </div>
      )}

      <CategoryFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open)
          if (!open) {
            setEditCategory(null)
            setAddParentId(null)
          }
        }}
        category={editCategory}
        parentId={addParentId}
        onSubmit={handleFormSubmit}
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
