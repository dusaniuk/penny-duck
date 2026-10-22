# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Penny Duck is a personal finance app (accounts, transactions, categories, investments, net worth). It is a pnpm + Turborepo monorepo: a **TanStack Start** web app (React 19 + Vite + Nitro) with **shadcn/ui**, talking to a **Hono** API on **Bun**, backed by PostgreSQL via **Drizzle**.

## Monorepo Structure

- `apps/web` — TanStack Start app (file-based routing via TanStack Router, TanStack Query, Nitro server, port 3000)
- `apps/api` — Hono API on Bun (port 3030), runs TypeScript from source
- `packages/ui` — Shared UI package: shadcn/ui components, hooks, utilities, and global styles
- `packages/db` — Drizzle schema, client, and SQL migrations (PostgreSQL, `app` and `auth` schemas)
- `packages/api-contract` — Zod request/response schemas and types shared by web and API (wire format only)
- `packages/shared` — Shared runtime helpers (`./categories`, `./currencies`, `./errors`)
- `packages/env` — Environment variable validation (t3-env + Zod): `@workspace/env/api`, `@workspace/env/web`
- `e2e` — Playwright API and UI suites

## Commands

All commands run from the repo root via Turborepo:

```bash
pnpm dev          # Start web (3000) and API (3030) dev servers
pnpm build        # Build all packages
pnpm lint         # Lint all packages (ESLint flat config)
pnpm lint:fix     # Lint with --fix
pnpm format       # Format with Prettier
pnpm typecheck    # TypeScript type checking (never run bare tsc — it emits .js files)
```

Per-package commands: `pnpm --filter web <script>`, `pnpm --filter api <script>`, `pnpm --filter @workspace/db <script>`, `pnpm --filter @workspace/ui <script>`

The husky pre-commit hook runs `pnpm lint -- --max-warnings 0` and `pnpm typecheck`.

### Database

```bash
pnpm db:up                             # Start local Postgres 18 (docker compose)
pnpm db:generate --name <kebab-case>   # Generate a migration from schema changes
pnpm db:migrate                        # Apply migrations (drizzle-kit)
pnpm db:studio                         # Open Drizzle Studio
```

**Always pass `--name` when generating migrations** so the SQL file gets a meaningful kebab-case name from the start (e.g. `pnpm db:generate --name add-investments` produces `0015_add-investments.sql`). Skipping `--name` yields a random superhero/villain name like `0015_open_betty_ross.sql`, which carries zero information in PR diffs and deploy logs.

Schema changes must go through Drizzle migrations — don't use `db:push` for anything that ships.

drizzle-kit loads `.env` with plain `dotenv` (no interpolation), so `DATABASE_URL` in `.env` must be a literal URL.

### Tests

```bash
pnpm test:unit                  # API tests (bun test, reads .env.test)
pnpm --filter api test:watch    # API tests in watch mode
pnpm --filter web test          # Web unit tests (Vitest, *.test.ts)
pnpm --filter @workspace/ui test  # UI package unit tests (Vitest)
pnpm test:e2e                   # Playwright API + UI suites (starts dev servers automatically)
pnpm test:e2e:api               # Playwright API suite only
pnpm test:e2e:ui                # Playwright UI suite only
```

- API tests live next to the code as `*.spec.ts`. `apps/api/src/test/preload.ts` (via `bunfig.toml`) runs migrations against the test DB, stubs `fetch` with fixture FX rates (any other host throws), and mocks `yahoo-finance2`. Tests must not hit the network.
- Unit and e2e tests share the `penny_duck_test` database (created by `docker/init`) and truncate it — don't run them concurrently.

## Adding shadcn/ui Components

```bash
pnpm dlx shadcn@latest add <component> -c apps/web
```

This places components in `packages/ui/src/components/`. The shadcn config lives at `apps/web/components.json`.

- Style: `radix-nova`
- Icon library: `@tabler/icons-react`
- Import UI components as: `@workspace/ui/components/<name>`
- Import utilities as: `@workspace/ui/lib/utils`

## Design System Artifact

The Penny Duck design system lives in a Claude artifact (https://claude.ai/artifact/B6m44Fd1Q65NcMgLSg1fhY). Its code-derived files are rebuilt by `packages/ui/scripts/design-system/build.ts`, which sits outside the app build and turbo:

```bash
pnpm --filter @workspace/ui build:design-system --base <artifact tokens.json>
```

- Writes `packages/ui/dist/design-system/`, laid out like the artifact's `project/` folder: `tokens.json`, `fonts/`, `components/bundle.{js,css}`, `components/lib/react*.js`
- Token values come from `globals.css` and `apps/web/src/lib/palette.ts`; `--base` (the artifact's current `project/tokens.json`) keeps the prose written on the artifact (usage notes, type styles, spacing, sizes). The script prints which tokens changed, were added, or were removed
- To re-sync: read `project/tokens.json` from the artifact, run the script, publish the changed files to `project/<same path>`, and record the change in the artifact's `lastChange`
- A new component needs an export in `scripts/design-system/entry.ts`, an entry in `COMPONENTS`, and a `preview.html` + `README.md` written on the artifact

## Key Conventions

- **Tailwind CSS v4** — configured via `@tailwindcss/vite` plugin, styles in `packages/ui/src/styles/globals.css`
- **Prettier** — no semicolons, double quotes, trailing commas (es5), 2-space indent, with `prettier-plugin-tailwindcss`
- **Utility functions** — `cn()` (clsx + tailwind-merge) and `cva` for component variants
- **Route files** — `apps/web/src/routes/` using TanStack Router file-based routing. `routeTree.gen.ts` is auto-generated — do not edit manually
- **Package exports** — `@workspace/ui` uses subpath exports (`./components/*`, `./lib/*`, `./hooks/*`)
- **Inputs** — use `text-base` (16px) on inputs; never add responsive classes that shrink them below 16px (iOS Safari zooms)
- **No lint suppression** — fix lint issues properly, never add `eslint-disable` comments
- **No explanatory one-liner comments** — don't add comments narrating a small styling or layout choice (e.g. why a class sits on one element rather than another). Only comment non-obvious logic
- **Do not commit** files under `docs/superpowers/` (specs, plans) — these are local working documents

## API Architecture

Plain Hono modules — no DI container, no DDD layers. Keep it that way unless a module's complexity genuinely demands more.

```
apps/api/src/
  main.ts          Bun entry (exports { port, fetch })
  app.ts           Hono app: CORS, /healthz, route mounting, error handlers; exports AppType
  db.ts            Shared Drizzle client + Executor type (db or transaction)
  middleware/      honoAuthMiddleware (session → c.get("user")), apiKeyAuthMiddleware (x-api-key → c.get("ingest"))
  modules/<name>/
    routes.ts      Hono router: zValidator with api-contract schemas, reads user.organizationId, calls service
    service.ts     Plain async functions doing Drizzle queries and business rules; throw HTTPException for errors
    *.spec.ts      Bun tests
```

- Modules: `accounts`, `auth`, `categories`, `exchange-rates`, `inbox`, `investments` (instruments, positions, trades, IBKR CSV import), `invites`, `organizations`, `stats` (incl. net worth), `transactions`, `users`, `wallets`
- All data is scoped by `organizationId` (Better Auth organization); every query must filter on it
- Errors: `app.ts` turns `HTTPException` and `ZodError` into the `ApiError` shape from `@workspace/shared/errors`
- `@workspace/api-contract` is the wire format only — no behavior. Prefer loose types (`z.string()`) over `z.enum` when the value set is a frontend concern
- Path alias `@/` → `apps/api/src/`
- External data: FX rates from the fawazahmed0 currency-api (jsDelivr / pages.dev), instrument quotes from `yahoo-finance2`

## Web ↔ API

- The web app calls the API through a typed Hono RPC client: `api = hc<AppType>("/api")` in `apps/web/src/lib/api.ts`, with TanStack Query (`queryClient` in the same file)
- Wrap calls in `unwrap()` from the same file: `queryFn: () => unwrap(api.accounts.$get())`. It returns the typed success body and throws `ApiRequestError` (`apps/web/src/lib/errors.ts`, carries `statusCode`/`code`/`details`) on non-2xx. Only branch on `res.ok` by hand when a non-2xx is an expected result (e.g. a 404 that means "none")
- Not Hono's built-in `parseResponse`: its `DetailedError` puts the status line in `message` and buries the API error body in `detail.data`, which breaks `errorMessage()` toasts
- Nitro proxies `/api/**` → `API_URL` (`routeRules` in `apps/web/vite.config.ts`) so cookies are same-origin; the proxy strips the `/api` prefix
- Because `AppType` is inferred from `app.ts`, new routes must be chained onto the Hono builders (not registered imperatively) to show up on the client

## Auth

- Better Auth 1.7 (self-hosted) in the API: DB sessions in the `auth` schema, httpOnly `penny-duck.session_token` cookie (7d sliding) + 5 min `session_data` cookie cache
- `apps/api/src/modules/auth/auth.ts` is the single auth config; organization provisioning lives in its `databaseHooks`
- Mounted at `/auth/*`; the handler rewrites the path to `/api/auth/*` because the Nitro proxy strips `/api`
- Google sign-in when `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are set; redirect URI `${WEB_URL}/api/auth/callback/google`
- API keys (`@better-auth/api-key`, prefix `pd_`, 60 req/min) grant `inbox: ["write"]` for the wallet inbox ingest endpoint
- SSR auth check: `getAuthUser()` in `apps/web/src/lib/auth.ts` forwards the request cookie to `/users/me`; client-side auth uses `apps/web/src/lib/auth-client.ts`

## Local Development

- `.env` at the repo root (copy `.env.example`); `.env.test` for tests (not committed, points at `penny_duck_test`)
- Postgres runs in Docker on `127.0.0.1:5433`; `docker/init` creates the `app` schema and the test database on first start
- The API dev server uses `bun --hot`, which doesn't always pick up schema or api-contract changes — restart it after those

## Deployment (Cloud Run)

Hosted on Google Cloud Run in `europe-west3` (Frankfurt) with two services, **web** (public) and **api** (IAM-only), plus a **migrate** job. The Postgres database is hosted on **Neon** (Postgres 18, eu-central-1, direct/non-pooler connection URL with `sslmode=verify-full`). Infrastructure is Terraform in `infra/` (see `infra/README.md`); Yaro runs `terraform plan`/`apply` locally.

### Build & Deploy

`.github/workflows/deploy.yml` runs on every push to `main`: build both images → push to Artifact Registry → run the `migrate` job and wait → `gcloud run deploy api` → `gcloud run deploy web`. GitHub authenticates through Workload Identity Federation (no stored key), pinned to this repo's ID and `refs/heads/main`. Terraform ignores image changes; CI owns them.

- **API** — `apps/api/Dockerfile`: `turbo prune api --docker` → prod-only pnpm install → `oven/bun` runtime running `apps/api/src/main.ts` from source (no build step)
- **Web** — `apps/web/Dockerfile`: `turbo prune web --docker` → install + `vite build` → `oven/bun` runtime with only `.output/` (Nitro output is self-contained)
- **Migrations** run as the `migrate` Cloud Run job (API image, `bun --cwd packages/db src/migrate.ts` — drizzle-orm `migrate()` programmatically; the drizzle-kit CLI silently failed in the hosted runtime). A failed migration stops the deploy before either service changes. It runs before the new API passes its startup probe, so set new required env vars/secrets first
- **web → api**: the API accepts only callers with a Google ID token for its URL. `apps/web/src/server/api-auth.ts` fetches one from the metadata server (cached, refreshed 5 min before expiry) and sends it as `X-Serverless-Authorization` on the `/api/**` proxy and SSR auth calls. Locally `API_IAM_AUDIENCE` is unset and nothing is signed
- **Production** means `NODE_ENV === "production"` (set by both Dockerfiles, never by dev/tests). It closes sign-up and enables rate limiting, and fails closed
- API runs `max_instance_count = 1` because Better Auth's rate limiter is in-memory
- Bun is pinned in three places that must move together: `.bun-version` (local, read by mise), and the `oven/bun:<version>` tag in both Dockerfiles
- `.dockerignore` keeps env files and build artifacts out of the build context
- Turbo runs in strict env mode: build-time vars must be listed in `turbo.json` (`API_URL` is)
- Logs are JSON lines with `severity`, `message` and `time`, which Cloud Logging parses
- Cloud Run domain mapping isn't available in `europe-west3`, so the app is on `web-<project_number>.europe-west3.run.app` for now (custom domain options in `infra/README.md`)

Build locally with `docker build -f apps/api/Dockerfile .` (web needs `--build-arg API_URL=...`).

### Environment Variables

Secrets live in Secret Manager (`database-url`, `better-auth-secret`, `google-client-id`, `google-client-secret`); Terraform creates them empty and values are added with `gcloud secrets versions add`, so they never reach Terraform state.

- **api**: `DATABASE_URL` (Neon direct connection string), `BETTER_AUTH_SECRET` (min 32 chars), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `WEB_URL`; optional `MAX_BODY_SIZE_MB` (default 1). `PORT` is injected by Cloud Run (8080); don't set it. `GIT_COMMIT_SHA` is baked in by CI as a build arg
- **web**: `API_URL` — used at build time (baked into the Nitro `/api/**` proxy target, passed as a Docker build arg) and at runtime (SSR auth in `auth.ts`); `API_IAM_AUDIENCE` (the API URL) turns on ID-token signing
- **GitHub repository variables**: `GCP_PROJECT_ID`, `GCP_REGION`, `GCP_WIF_PROVIDER`, `GCP_DEPLOYER_EMAIL`, `API_URL`

## Legal

When features change (e.g., new data collected, third-party integrations, auth changes), review and update `apps/web/src/content/legal/terms.mdx` and `apps/web/src/content/legal/privacy.mdx` accordingly.

## Branching & Releases

- **`main`** is the production branch — every push triggers the GitHub Actions deploy to Cloud Run. Never commit to it directly
- Work on a version branch (e.g. `v0.2.0`), push freely without triggering deploys
- Release with `/release` (`.claude/commands/release.md`): rebase, fast-forward `main`, signed tag, next version branch
- **Semver**: PATCH = bug fixes, MINOR = new features, MAJOR = breaking changes visible to users. While on `0.x`, no need to bump major for breaking changes

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `python3 -c "from graphify.watch import _rebuild_code; from pathlib import Path; _rebuild_code(Path('.'))"` to keep the graph current
