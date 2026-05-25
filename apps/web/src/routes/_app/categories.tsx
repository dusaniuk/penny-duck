import { createFileRoute } from "@tanstack/react-router"
import { PageHeader } from "@/components/page-header"

export const Route = createFileRoute("/_app/categories")({
  staticData: { breadcrumb: "Categories" },
  component: CategoriesPage,
})

function CategoriesPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Categories"
        title="Tag your money"
        description="Group transactions under the labels that mean something to you."
      />
    </div>
  )
}
