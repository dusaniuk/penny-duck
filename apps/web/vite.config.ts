import { defineConfig } from "vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import { nitro } from "nitro/vite"
import mdx from "@mdx-js/rollup"

const apiUrl = process.env.API_URL ?? "http://localhost:3030"

const config = defineConfig({
  envDir: "../../",
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    watch: {
      ignored: ["**/routeTree.gen.ts"],
    },
  },
  plugins: [
    nitro({
      preset: "bun",
      routeRules: {
        "/api/**": {
          proxy: {
            to: `${apiUrl}/**`,
            fetchOptions: { redirect: "manual" },
          },
        },
        "/**": {
          headers: {
            "Content-Security-Policy":
              "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'self'; object-src 'none'",
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
            "X-DNS-Prefetch-Control": "off",
          },
        },
      },
    }),
    tailwindcss(),
    mdx(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
