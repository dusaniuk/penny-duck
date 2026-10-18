# Penny Duck

A personal finance app: a TanStack Start web app backed by a Hono API on Bun.

## Tech Stack

- **Frontend**: TanStack Start (React 19 + Vite + Nitro SSR), TanStack Router, Tailwind CSS v4
- **UI**: shadcn/ui (Radix Nova style) with @tabler/icons-react
- **Backend**: Hono on Bun
- **Database**: PostgreSQL 18, Drizzle ORM
- **Auth**: Better Auth sessions (httpOnly cookie, stored in Postgres) with optional Google sign-in
- **Monorepo**: pnpm workspaces + Turborepo
- **Tests**: Bun test (API), Vitest (web, ui), Playwright (e2e)

## Project Structure

```
apps/
  web/            TanStack Start app (port 3000)
  api/            Hono API (port 3030)
packages/
  ui/             Shared UI components (shadcn/ui)
  db/             Database schema, client and migrations (Drizzle)
  api-contract/   Request/response schemas shared by web and API (Zod)
  shared/         Shared utilities
  env/            Environment variable validation (t3-env + Zod)
e2e/              Playwright API and UI tests
```

## Prerequisites

- Node.js 22+
- pnpm 9+
- Bun 1.4.3 (pinned in `.bun-version`; [mise](https://mise.jdx.dev) picks it up automatically)
- Docker (for PostgreSQL)

## Getting Started

1. **Install dependencies**

```bash
pnpm install
```

2. **Set up environment variables**

```bash
cp .env.example .env
```

`DATABASE_URL` must be a full URL, because drizzle-kit loads `.env` without variable interpolation. Replace the templated value with:

```
DATABASE_URL=postgresql://penny:duck@localhost:5433/penny_duck
```

For production, generate a proper `BETTER_AUTH_SECRET` (at least 32 characters):

```bash
openssl rand -base64 32
```

Google sign-in is optional and is enabled only when both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set.

3. **Start the database**

```bash
pnpm db:up
```

On first start this also creates the `penny_duck_test` database used by the tests.

4. **Run database migrations**

```bash
pnpm db:migrate
```

5. **Start development servers**

```bash
pnpm dev
```

This starts the web app (http://localhost:3000) and the API (http://localhost:3030).

## Commands

```bash
pnpm dev          # Start all dev servers
pnpm build        # Build all packages
pnpm lint         # Lint all packages
pnpm format       # Format with Prettier
pnpm typecheck    # TypeScript type checking
```

### Per-package commands

```bash
pnpm --filter web <script>
pnpm --filter api <script>
pnpm --filter @workspace/db <script>
```

### Database

```bash
pnpm db:generate --name <kebab-case>   # Generate a migration from schema changes
pnpm db:migrate                        # Apply migrations
pnpm db:studio                         # Open Drizzle Studio
```

Always pass `--name` so the migration file gets a meaningful name.

### Tests

Tests read `.env.test` (not committed), which points `DATABASE_URL` at `penny_duck_test`.

```bash
pnpm test:unit    # API unit tests (Bun)
pnpm --filter web test   # Web unit tests (Vitest)
pnpm test:e2e     # Playwright API + UI tests (starts dev servers automatically)
pnpm test         # API unit + e2e
```

## Adding shadcn/ui Components

```bash
pnpm dlx shadcn@latest add <component> -c apps/web
```

Components are placed in `packages/ui/src/components/`.

## Deployment

Hosted on Railway (web + API services, each built from its own Dockerfile) with the database on Neon. See `CLAUDE.md` for details.
