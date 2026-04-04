import { Outlet, createFileRoute, redirect } from "@tanstack/react-router"
import { getAuthUser } from "@/lib/auth"

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
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Outlet />
    </div>
  )
}
