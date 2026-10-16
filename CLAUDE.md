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

**Always pass `--name` when generating migrations** so the SQL file gets a meaningful kebab-case name from the start (e.g. `pnpm db:generate --name add-investments` produces `0015_add-investments.sql`). Skipping `--name` yields a random superhero/villain name like `0015_open_betty_ross.sql`, which carries zero information in PR diffs and deploy logs.

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
- **No explanatory one-liner comments** — don't add comments narrating a small styling or layout choice (e.g. why a class sits on one element rather than another). Only comment non-obvious logic
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

- Better Auth 1.7 (self-hosted) in the Hono API: DB sessions in the `auth` schema, httpOnly `penny-duck.session_token` cookie (7d sliding) + 5 min `session_data` cookie cache
- `apps/api/src/modules/auth/auth.ts` is the single auth config; organization provisioning lives in its `databaseHooks`
- Mounted at `/auth/*`; the handler rewrites the path to `/api/auth/*` because the Nitro proxy strips `/api`
- Google sign-in when `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are set; redirect URI `${WEB_URL}/api/auth/callback/google`
- Frontend proxies API calls through Nitro (`/api/**` → `API_PROXY_TARGET`) for same-origin cookies
- SSR auth check: `getAuthUser()` in `apps/web/src/lib/auth.ts` forwards the request cookie to `/users/me`

## Deployment (Railway)

Hosted on Railway with two services: **Web**, **API** (private networking only). The Postgres database is hosted on **Neon** (Postgres 18, eu-central-1, direct/non-pooler connection URL with `sslmode=verify-full`).

### Build & Start

Each service builds from its own Dockerfile, configured as code in its `railway.json` (Railway → service → Settings → Config-as-code path):

- **API** — `apps/api/Dockerfile`: `turbo prune api --docker` → prod-only pnpm install → `oven/bun` runtime running `apps/api/src/main.ts` from source (no build step)
- **Web** — `apps/web/Dockerfile`: `turbo prune web --docker` → install + `vite build` → `oven/bun` runtime with only `.output/` (Nitro output is self-contained)
- **Pre-deploy migration** (API): `bun --cwd packages/db src/migrate.ts` — drizzle-orm `migrate()` programmatically (drizzle-kit CLI silently fails on Railway)
- Bun is pinned in three places that must move together: `.bun-version` (local, read by mise), and the `oven/bun:<version>` tag in both Dockerfiles
- `.dockerignore` keeps env files and build artifacts out of the build context; watch paths live in each `railway.json`

Build locally with `docker build -f apps/api/Dockerfile .` (web needs `--build-arg API_URL=...`).

### Environment Variables

- **API service**: `DATABASE_URL` (Neon direct connection string), `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `WEB_URL`, `PORT=3030`
- **Web service**: `API_URL` — used at build time (baked into the Nitro `/api/**` proxy target, passed as a Docker build arg) and at runtime (SSR auth in `auth.ts`)

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
git merge --ff-only refs/heads/v0.2.0
git tag -m "v0.2.0" v0.2.0
git push origin main refs/tags/v0.2.0
```

- Tags must be annotated (`tag.gpgsign` is on): always `git tag -m "<version>" <version>`; a bare `git tag` fails with "no tag message?"
- Push only the release tag, never `--tags` (it publishes every stray local tag)
- Version branch and tag share a name — use `refs/heads/` / `refs/tags/` where a ref could be ambiguous

- **Semver**: PATCH = bug fixes, MINOR = new features, MAJOR = breaking changes visible to users
- While on `0.x`, no need to bump major for breaking changes
- After merging, delete the version branch (local + remote), then create the next version branch (bump minor)

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"` to keep the graph current
