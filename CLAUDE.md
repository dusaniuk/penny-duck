# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Penny Duck is a monorepo using **TanStack Start** (React 19 + Vite + Nitro) with **shadcn/ui** components. Managed with pnpm workspaces and Turborepo.

## Monorepo Structure

- `apps/web` — TanStack Start app (file-based routing via TanStack Router, Nitro server)
- `packages/ui` — Shared UI package: shadcn/ui components, hooks, utilities, and global styles

## Commands

All commands run from the repo root via Turborepo:

```bash
pnpm dev          # Start dev server (port 3000)
pnpm build        # Build all packages
pnpm lint         # Lint all packages (ESLint flat config)
pnpm format       # Format with Prettier
pnpm typecheck    # TypeScript type checking
```

Per-package commands: `pnpm --filter web <script>` or `pnpm --filter @workspace/ui <script>`

## Adding shadcn/ui Components

```bash
pnpm dlx shadcn@latest add <component> -c apps/web
```

This places components in `packages/ui/src/components/`. The shadcn config lives at `apps/web/components.json`.

- Style: `radix-mira`
- Icon library: `@tabler/icons-react`
- Import UI components as: `@workspace/ui/components/<name>`
- Import utilities as: `@workspace/ui/lib/utils`

## Key Conventions

- **Tailwind CSS v4** — configured via `@tailwindcss/vite` plugin, styles in `packages/ui/src/styles/globals.css`
- **Prettier** — no semicolons, double quotes, trailing commas (es5), 2-space indent, with `prettier-plugin-tailwindcss`
- **Utility functions** — `cn()` (clsx + tailwind-merge) and `cva` for component variants
- **Route files** — `apps/web/src/routes/` using TanStack Router file-based routing. `routeTree.gen.ts` is auto-generated — do not edit manually
- **Package exports** — `@workspace/ui` uses subpath exports (`./components/*`, `./lib/*`, `./hooks/*`)
