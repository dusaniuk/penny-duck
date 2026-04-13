import { Outlet, createFileRoute, redirect } from "@tanstack/react-router"
import {
  IconCashBanknote,
  IconCategory,
  IconLayoutDashboard,
  IconReceipt,
  IconWallet,
} from "@tabler/icons-react"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb"
import { Separator } from "@workspace/ui/components/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@workspace/ui/components/sidebar"
import type { NavItem } from "@/components/app-sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { NavUser } from "@/components/nav-user"
import { getAuthUser } from "@/lib/auth"

const mainNav: Array<NavItem> = [
  { title: "Dashboard", url: "/dashboard", icon: IconLayoutDashboard },
  { title: "Transactions", url: "/transactions", icon: IconReceipt },
  { title: "Accounts", url: "/accounts", icon: IconWallet },
  { title: "Categories", url: "/categories", icon: IconCategory },
]

export const Route = createFileRoute("/_app")({
  beforeLoad: async () => {
    const user = await getAuthUser()
    if (!user) {
      throw redirect({ to: "/login" })
    }
    return { user }
  },
  component: AppLayout,
})

function AppLayout() {
  const { user } = Route.useRouteContext()

  return (
    <SidebarProvider>
      <AppSidebar
        header={{
          label: "Penny Duck",
          url: "/dashboard",
          icon: IconCashBanknote,
        }}
        nav={mainNav}
        footer={<NavUser user={user} />}
      />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="#">
                    Build Your Application
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Data Fetching</BreadcrumbPage>
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
