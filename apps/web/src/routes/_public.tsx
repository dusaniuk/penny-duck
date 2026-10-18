import { Outlet, createFileRoute } from "@tanstack/react-router"
import { PublicShell } from "@/components/public-shell"

export const Route = createFileRoute("/_public")({
  component: PublicLayout,
})

function PublicLayout() {
  return (
    <PublicShell>
      <article className="prose max-w-none prose-neutral dark:prose-invert">
        <Outlet />
      </article>
    </PublicShell>
  )
}
