"use client"

import { IconDeviceDesktop, IconMoon, IconSun } from "@tabler/icons-react"
import { useTheme } from "./theme-provider"
import { Button } from "./button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu"
import type {Theme} from "./theme-provider";

const options: Array<{ value: Theme; label: string; icon: React.ReactNode }> = [
  { value: "light", label: "Light", icon: <IconSun className="size-4" /> },
  { value: "dark", label: "Dark", icon: <IconMoon className="size-4" /> },
  {
    value: "system",
    label: "System",
    icon: <IconDeviceDesktop className="size-4" />,
  },
]

function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const current = options.find((o) => o.value === theme) ?? options[2]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          {current.icon}
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {options.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => setTheme(option.value)}
          >
            {option.icon}
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export { ThemeToggle }
