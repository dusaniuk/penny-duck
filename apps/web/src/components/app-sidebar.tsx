"use client"

import * as React from "react"
import { Link, useMatchRoute } from "@tanstack/react-router"
import {
  IconCashBanknote,
  IconCategory,
  IconLayoutDashboard,
  IconReceipt,
  IconWallet,
} from "@tabler/icons-react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@workspace/ui/components/sidebar"
import { NavUser } from "@/components/nav-user"

const mainNav = [
  { title: "Dashboard", url: "/dashboard", icon: IconLayoutDashboard },
  { title: "Transactions", url: "/transactions", icon: IconReceipt },
]

const manageNav = [
  { title: "Accounts", url: "/accounts", icon: IconWallet },
  { title: "Categories", url: "/categories", icon: IconCategory },
]

export function AppSidebar({
  user,
  ...props
}: { user: { name: string; email: string } } & React.ComponentProps<
  typeof Sidebar
>) {
  const matchRoute = useMatchRoute()

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <Link to="/dashboard">
                <IconCashBanknote className="size-5!" />
                <span className="text-base font-semibold">Penny Duck</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {mainNav.map((item) => (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton
                  asChild
                  isActive={!!matchRoute({ to: item.url })}
                >
                  <Link to={item.url}>
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Manage</SidebarGroupLabel>
          <SidebarMenu>
            {manageNav.map((item) => (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton
                  asChild
                  isActive={!!matchRoute({ to: item.url })}
                >
                  <Link to={item.url}>
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
