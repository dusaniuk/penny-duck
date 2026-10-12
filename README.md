# Penny Duck

A monorepo web application built with TanStack Start and NestJS.

## Tech Stack

- **Frontend**: TanStack Start (React 19 + Vite + Nitro SSR), TanStack Router, Tailwind CSS v4
- **UI**: shadcn/ui (Radix Mira style) with @tabler/icons-react
- **Backend**: NestJS with DDD/CQRS architecture
- **Database**: PostgreSQL 17, Drizzle ORM
- **Auth**: Better Auth sessions (httpOnly cookie, stored in Postgres) with optional Google sign-in
- **Monorepo**: pnpm workspaces + Turborepo

## Project Structure

```
apps/
  web/     TanStack Start app (port 3000)
  api/     NestJS API (port 3030)
packages/
  ui/      Shared UI components (shadcn/ui)
  db/      Database schema and client (Drizzle)
  env/     Environment variable validation (t3-env + Zod)
```

## Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (for PostgreSQL)

## Getting Started

1. **Clone and install dependencies**

```bash
git clone <repo-url>
cd penny-duck
pnpm install
```

2. **Set up environment variables**

```bash
cp .env.example .env
```

Edit `.env` if needed. Defaults work out of the box for local development. For production, generate a proper `BETTER_AUTH_SECRET` (at least 32 characters):

```bash
openssl rand -base64 32
```

Google sign-in is optional and is enabled only when both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set.

Note: `DATABASE_URL` must be a full URL (no shell variable interpolation):

```
DATABASE_URL=postgresql://penny:duck@localhost:5433/penny_duck
```

3. **Start the database**

```bash
docker compose up -d
```

4. **Run database migrations**

```bash
pnpm --filter @workspace/db drizzle-kit migrate
```

5. **Start development servers**

```bash
pnpm dev
```

This starts both the web app (http://localhost:3000) and the API (http://localhost:3030).

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
pnpm --filter @workspace/db drizzle-kit generate   # Generate migration from schema changes
pnpm --filter @workspace/db drizzle-kit migrate     # Apply migrations
pnpm --filter @workspace/db drizzle-kit studio      # Open Drizzle Studio
```

### Tests

```bash
pnpm --filter api test          # Run API tests once
pnpm --filter api test:watch    # Run API tests in watch mode
```

## Adding shadcn/ui Components

```bash
pnpm dlx shadcn@latest add <component> -c apps/web
```

Components are placed in `packages/ui/src/components/`.
