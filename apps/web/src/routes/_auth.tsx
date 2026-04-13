import { Outlet, createFileRoute, redirect } from "@tanstack/react-router"
import { getAuthUser } from "@/lib/auth"
import { Footer } from "@/components/footer"

export const Route = createFileRoute("/_auth")({
  beforeLoad: async () => {
    const user = await getAuthUser()
    if (user) {
      throw redirect({ to: "/dashboard" })
    }
  },
  component: AuthLayout,
})

function AuthLayout() {
  return (
    <div className="flex min-h-svh flex-col bg-muted/40 p-4">
      <div className="flex flex-1 items-center justify-center">
        <Outlet />
      </div>
      <Footer />
    </div>
  )
}
