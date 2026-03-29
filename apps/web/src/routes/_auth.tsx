import { Outlet, createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
})

function AuthLayout() {
  return (
    <div className="flex min-h-svh items-center justify-center bg-muted/40 p-4">
      <Outlet />
    </div>
  )
}
