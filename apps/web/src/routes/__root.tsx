import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router"
import { QueryClientProvider } from "@tanstack/react-query"
import { TooltipProvider } from "@workspace/ui/components/tooltip"
import { ThemeProvider } from "@workspace/ui/components/theme-provider"
import appCss from "@workspace/ui/globals.css?url"
import { themeScript } from "@workspace/ui/lib/theme-script"
import { Toaster } from "sonner"
import { queryClient } from "@/lib/api"

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Penny Duck",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
  component: RootLayout,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

function RootLayout() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Outlet />
          <Toaster richColors />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
