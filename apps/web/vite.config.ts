import { defineConfig } from "vite"
import { tanstackStart } from "@tanstack/react-start/plugin/vite"
import viteReact from "@vitejs/plugin-react"
import viteTsConfigPaths from "vite-tsconfig-paths"
import tailwindcss from "@tailwindcss/vite"
import { nitro } from "nitro/vite"

const apiUrl = process.env.API_PROXY_TARGET ?? "http://localhost:3030"

const config = defineConfig({
  envDir: "../../",
  plugins: [
    nitro({
      routeRules: {
        "/api/**": {
          proxy: `${apiUrl}/**`,
        },
      },
    }),
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
