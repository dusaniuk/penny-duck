"use client"

import * as React from "react"
import { Link, useMatchRoute } from "@tanstack/react-router"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@workspace/ui/components/sidebar"

export type NavItem = {
  title: string
  url: string
  icon: React.ComponentType<{ className?: string }>
}

export function AppSidebar({
  header,
  nav,
  footer,
  ...props
}: {
  header: {
    label: string
    url: string
    icon: React.ComponentType<{ className?: string }>
  }
  nav: Array<NavItem>
  footer?: React.ReactNode
} & React.ComponentProps<typeof Sidebar>) {
  const matchRoute = useMatchRoute()
  const { setOpenMobile } = useSidebar()

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:p-1.5!"
            >
              <Link to={header.url} onClick={() => setOpenMobile(false)}>
                <header.icon className="size-5!" />
                <span className="text-base font-semibold">{header.label}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {nav.map((item) => (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton
                  asChild
                  isActive={!!matchRoute({ to: item.url })}
                >
                  <Link to={item.url} onClick={() => setOpenMobile(false)}>
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      {footer && <SidebarFooter>{footer}</SidebarFooter>}
      <SidebarRail />
    </Sidebar>
  )
}
