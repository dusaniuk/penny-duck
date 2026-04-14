import { resolve } from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    root: "./src",
  },
  resolve: {
    conditions: ["default"],
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
})
