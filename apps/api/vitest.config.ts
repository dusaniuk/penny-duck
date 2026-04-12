import { resolve } from "node:path"
import { defineConfig } from "vitest/config"
import swc from "unplugin-swc"

export default defineConfig({
  plugins: [
    swc.vite({
      module: { type: "es6" },
    }),
  ],
  test: {
    root: "./src",
    globals: true,
    fileParallelism: false,
    globalSetup: [resolve(__dirname, "./src/test/global-setup.ts")],
    setupFiles: [resolve(__dirname, "./src/test/env-setup.ts")],
  },
  resolve: {
    conditions: ["default"],
    alias: {
      "@": resolve(__dirname, "./src"),
    },
  },
})
