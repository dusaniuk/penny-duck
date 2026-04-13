import { Outlet, createFileRoute, redirect } from "@tanstack/react-router"
import { IconArrowLeft, IconUser, IconUsers } from "@tabler/icons-react"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@workspace/ui/components/breadcrumb"
import { Separator } from "@workspace/ui/components/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"
import type { NavItem } from "@/components/app-sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { getAuthUser } from "@/lib/auth"

const settingsNav: Array<NavItem> = [
  { title: "Profile", url: "/settings/profile", icon: IconUser },
  { title: "Members", url: "/settings/members", icon: IconUsers },
]

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
      <AppSidebar
        header={{
          label: "Back to app",
          url: "/dashboard",
          icon: IconArrowLeft,
        }}
        nav={settingsNav}
      />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbPage>Settings</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
