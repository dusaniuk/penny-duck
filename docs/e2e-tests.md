# E2E Tests

End-to-end tests using Playwright, split into two suites: **API** (HTTP-level) and **UI** (browser-level).

## Running Tests

From the repo root:

```bash
pnpm test:e2e          # Run both API and UI suites
pnpm test:e2e:api      # API suite only
pnpm test:e2e:ui       # UI suite only
```

Dev servers are started automatically by Playwright — no need to run them manually. The API suite starts the NestJS server on port 4030; the UI suite starts both the API (4030) and the web app (4000). If servers are already running on those ports (outside CI), Playwright reuses them.

## Prerequisites

- PostgreSQL running (`docker compose up -d`)
- `.env.test` in the repo root with a `DATABASE_URL` pointing to a **test database** (must contain "test" in the URL — the cleanup helper checks this as a safety guard)

That's it. Migrations and table truncation are handled automatically by each suite's global setup.

## Structure

```
e2e/
  shared/              Utilities shared across suites
    env.ts             Loads .env.test, exports env config
    db.ts              Drizzle client, truncateAll()
    factories.ts       faker-based test data generators
    server.ts          Runs Drizzle migrations via pnpm
  api/
    playwright.config.ts
    global-setup.ts    Runs migrations + truncates tables
    tests/
      auth-signup.spec.ts
      auth-login.spec.ts
      auth-logout.spec.ts
      users-me.spec.ts
      invite-flow.spec.ts
      accounts-crud.spec.ts
      categories-crud.spec.ts
  ui/
    playwright.config.ts
    global-setup.ts    Runs migrations + truncates tables
    tests/
      signup-flow.spec.ts
      login-flow.spec.ts
      protected-routes.spec.ts
      logout-flow.spec.ts
```

## Test Suites

### API Tests

Direct HTTP requests via Playwright's request API. Base URL defaults to `http://localhost:4030`.

| File | Covers |
|------|--------|
| `auth-signup.spec.ts` | `POST /auth/sign-up/email`: signup, auto sign-in, duplicate email (422), validation (400) |
| `auth-login.spec.ts` | `POST /auth/sign-in/email`: login, wrong password / unknown email (401), missing fields (400) |
| `auth-logout.spec.ts` | `POST /auth/sign-out`: session stops working after sign-out |
| `users-me.spec.ts` | `GET /users/me`: authenticated user retrieval, 401 without a session |
| `invite-flow.spec.ts` | `GET /invites/:code`, `POST /invites`, signup with an invite code |
| `accounts-crud.spec.ts` | Full CRUD, validation, 401 without auth |
| `categories-crud.spec.ts` | Seeded categories, hierarchy, CRUD, cascade delete |

### UI Tests

Browser tests using Chromium. Base URL defaults to `http://localhost:4000`.

| File | Covers |
|------|--------|
| `signup-flow.spec.ts` | Signup redirect, duplicate email error, HTML5 validation |
| `login-flow.spec.ts` | Login redirect, credential errors, field validation |
| `protected-routes.spec.ts` | Auth redirects (unauth to /login, auth to /dashboard) |
| `logout-flow.spec.ts` | Logout redirect, post-logout access denied |

## Data Isolation

- **Global setup** runs migrations and truncates the app tables and `auth.verifications` before the suite starts
  (`auth.sessions` and `auth.accounts` cascade from `app.users`)
- **Per-test setup** uses `beforeEach` hooks to create fresh users/data via factories
- **Factories** generate random data with faker to avoid collisions between parallel tests

## Shared Utilities

### `env.ts`

Loads `.env.test` from the repo root and exports an `env` object:

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | (required) | Test database connection string |
| `API_PORT` | `4030` | Port for the API during tests |
| `API_BASE_URL` | `http://localhost:4030` | Base URL for API requests |
| `WEB_PORT` | `4000` | Port for the web app during tests |
| `WEB_BASE_URL` | `http://localhost:4000` | Base URL for browser tests |

### `db.ts`

- `getDb()` — singleton Drizzle client
- `truncateAll()` — clears test tables (refuses to run if "test" is not in the DATABASE_URL)
- `closeDb()` — closes the connection

### `factories.ts`

- `createUserData()` — random name, email, password
- `createAccountData(overrides?)` — random account with optional field overrides

### `server.ts`

- `runMigrations(repoRoot, databaseUrl)` — spawns Drizzle migration via pnpm

## Configuration

Both suites share common Playwright settings:

- **Parallelism**: fully parallel (`fullyParallel: true`)
- **Retries**: 0
- **Reporter**: HTML
- **Timeouts**: 30s per test, 120s (API) / 180s (UI) global
- **Server reuse**: enabled outside CI (`reuseExistingServer: !process.env.CI`)
