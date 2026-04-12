import { Link, useMatchRoute } from "@tanstack/react-router"
import { IconArrowLeft, IconUser, IconUsers } from "@tabler/icons-react"
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@workspace/ui/components/sidebar"

const settingsNav = [
  { title: "Profile", url: "/settings/profile", icon: IconUser },
  { title: "Members", url: "/settings/members", icon: IconUsers },
]

export function SettingsSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const matchRoute = useMatchRoute()
  const { setOpenMobile } = useSidebar()

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <Link to="/dashboard" onClick={() => setOpenMobile(false)}>
                <IconArrowLeft className="size-5!" />
                <span className="text-base font-medium">Back to app</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Settings</SidebarGroupLabel>
          <SidebarMenu>
            {settingsNav.map((item) => (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton
                  asChild
                  isActive={!!matchRoute({ to: item.url })}
                >
                  <Link
                    to={item.url}
                    onClick={() => setOpenMobile(false)}
                  >
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
