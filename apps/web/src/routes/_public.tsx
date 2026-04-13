import { Link, Outlet, createFileRoute } from "@tanstack/react-router"
import { IconCashBanknote } from "@tabler/icons-react"
import { Footer } from "@/components/footer"

export const Route = createFileRoute("/_public")({
  component: PublicLayout,
})

function PublicLayout() {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="flex items-center gap-2 border-b px-6 py-4">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <IconCashBanknote className="size-5" />
          Penny Duck
        </Link>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        <article className="prose prose-neutral dark:prose-invert max-w-none">
          <Outlet />
        </article>
      </main>
      <Footer />
    </div>
  )
}
