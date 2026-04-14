import {
  Link,
  Outlet,
  createFileRoute,
  redirect,
  useMatches,
} from "@tanstack/react-router"
import {
  IconCashBanknote,
  IconCategory,
  IconChartBar,
  IconChartDonut,
  IconLayoutDashboard,
  IconReceipt,
  IconWallet,
} from "@tabler/icons-react"
import {
  Breadcrumb,
  BreadcrumbItem,
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
import { ThemeToggle } from "@workspace/ui/components/theme-toggle"
import type { NavItem } from "@/components/app-sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { NavUser } from "@/components/nav-user"
import { getAuthUser } from "@/lib/auth"

const mainNav: Array<NavItem> = [
  { title: "Dashboard", url: "/dashboard", icon: IconLayoutDashboard },
  { title: "Spendings", url: "/spendings", icon: IconChartDonut },
  { title: "Income vs Expenses", url: "/income-expenses", icon: IconChartBar },
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
  const matches = useMatches()
  const crumbs = matches.filter(
    (m) =>
      m.staticData.breadcrumb ||
      (m.loaderData as Record<string, unknown> | undefined)?.crumb,
  )

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
                {crumbs.map((match, i) => {
                  const isLast = i === crumbs.length - 1
                  const label = (match.staticData.breadcrumb ??
                    (match.loaderData as Record<string, unknown> | undefined)
                      ?.crumb) as string
                  return (
                    <BreadcrumbItem key={match.id}>
                      {i > 0 && <BreadcrumbSeparator />}
                      {isLast ? (
                        <BreadcrumbPage>{label}</BreadcrumbPage>
                      ) : (
                        <Link
                          to={match.pathname}
                          className="text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {label}
                        </Link>
                      )}
                    </BreadcrumbItem>
                  )
                })}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="ml-auto px-4">
            <ThemeToggle />
          </div>
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
