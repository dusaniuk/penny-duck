import { Outlet, createFileRoute, redirect } from "@tanstack/react-router"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"
import { Separator } from "@workspace/ui/components/separator"
import { SettingsSidebar } from "@/components/settings-sidebar"
import { getAuthUser } from "@/lib/auth"

export const Route = createFileRoute("/settings")({
  beforeLoad: async () => {
    const user = await getAuthUser()
    if (!user) {
      throw redirect({ to: "/login" })
    }
    return { user }
  },
  component: SettingsLayout,
})

function SettingsLayout() {
  return (
    <SidebarProvider>
      <SettingsSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <span className="text-sm font-medium">Settings</span>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
