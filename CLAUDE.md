# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Penny Duck is a monorepo using **TanStack Start** (React 19 + Vite + Nitro) with **shadcn/ui** components. Managed with pnpm workspaces and Turborepo.

## Monorepo Structure

- `apps/web` — TanStack Start app (file-based routing via TanStack Router, Nitro server)
- `apps/api` — NestJS API (DDD/CQRS architecture, port 3030)
- `packages/ui` — Shared UI package: shadcn/ui components, hooks, utilities, and global styles
- `packages/db` — Database schema and Drizzle ORM client (PostgreSQL, `app` schema namespace)
- `packages/env` — Environment variable validation (t3-env + Zod)

## Commands

All commands run from the repo root via Turborepo:

```bash
pnpm dev          # Start dev server (port 3000)
pnpm build        # Build all packages
pnpm lint         # Lint all packages (ESLint flat config)
pnpm format       # Format with Prettier
pnpm typecheck    # TypeScript type checking
```

Per-package commands: `pnpm --filter web <script>`, `pnpm --filter api <script>`, or `pnpm --filter @workspace/ui <script>`

### Database

```bash
pnpm --filter @workspace/db drizzle-kit generate   # Generate migration from schema changes
pnpm --filter @workspace/db drizzle-kit migrate     # Apply migrations
pnpm --filter @workspace/db drizzle-kit studio      # Open Drizzle Studio
```

### Tests

```bash
pnpm --filter api test          # Run API tests (Vitest)
pnpm --filter api test:watch    # Watch mode
pnpm test:e2e                   # Run e2e tests (Playwright — starts dev servers automatically)
```

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
- **Do not commit** files under `docs/superpowers/` (specs, plans) — these are local working documents

## API Architecture (DDD/CQRS)

The NestJS API follows Domain-Driven Design with CQRS (`@nestjs/cqrs`):

```
apps/api/src/<module>/
  domain/          Pure TypeScript — entities, value objects, events, repository ports, errors
  application/     Commands, queries, event handlers (use cases)
  infrastructure/  Repository implementations (Drizzle), services (JWT, cookies), mappers
  presentation/    Controller, DTOs, guards, decorators, exception filters
```

- **Domain layer** has zero framework dependencies
- **Repository ports** are abstract classes in domain, implementations in infrastructure
- **Schema changes** must use Drizzle migrations (`drizzle-kit generate` + `drizzle-kit migrate`)

## Auth

- JWT access token (15min, httpOnly cookie) + opaque refresh token (7d, httpOnly cookie) with rotation
- Cookies set with `secure: true` in production, `sameSite: "lax"`
- Frontend proxies API calls through Nitro (`/api/**` → `API_PROXY_TARGET`) for same-origin cookies
- SSR auth checks use `createServerFn` + `getCookie` from `@tanstack/react-start/server`
- Auth helper: `apps/web/src/lib/auth.ts` — `getAuthUser()` server function, uses `API_URL` env var at runtime

## Deployment (Railway)

Hosted on Railway with three services: **Web**, **API** (private networking only), **Postgres**.

### Build & Start

```bash
pnpm build:api    # Build API + workspace deps (tsup + nest build)
pnpm build:web    # Build Web + workspace deps (tsup + vite build)
pnpm start:api    # node apps/api/dist/main.js
pnpm start:web    # node apps/web/.output/server/index.mjs
pnpm db:deploy    # Programmatic migration (pre-deploy command)
```

### Shared Packages

Workspace packages (`db`, `env`, `shared`, `api-contract`) are built with **tsup** (ESM, no DTS). Conditional exports: `node` → `dist/*.js` (production runtime), `default` → `src/*.ts` (Vite/bundlers/TypeScript).

### Environment Variables

- **API service**: `DATABASE_URL` (from Postgres plugin), `JWT_SECRET`, `WEB_URL`, `PORT=3030`
- **Web service**: `API_PROXY_TARGET` (build-time, Nitro proxy target), `API_URL` (runtime, SSR auth in `auth.ts`)
- **Migrations**: `pnpm db:deploy` runs `packages/db/dist/migrate.js` — uses drizzle-orm `migrate()` programmatically (drizzle-kit CLI silently fails on Railway)

## Legal

When features change (e.g., new data collected, third-party integrations, auth changes), review and update `apps/web/src/content/legal/terms.mdx` and `apps/web/src/content/legal/privacy.mdx` accordingly.

## Branching & Releases

- **`main`** is the production branch — linked to Railway, every push triggers a deploy
- Work on a version branch (e.g. `v0.2.0`), push freely without triggering deploys
- When ready to release: rebase onto main, fast-forward merge, tag, push

```bash
git checkout v0.2.0
git rebase main
git checkout main
git merge --ff-only v0.2.0
git tag v0.2.0
git push origin main --tags
```

- **Semver**: PATCH = bug fixes, MINOR = new features, MAJOR = breaking changes visible to users
- While on `0.x`, no need to bump major for breaking changes
- After merging, delete the version branch (local + remote), then create the next version branch (bump minor)

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"` to keep the graph current
