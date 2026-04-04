# Authentication

JWT-based authentication with refresh token rotation and per-family reuse detection.

## Overview

- All auth logic lives in the NestJS API (`apps/api/src/auth/`)
- Frontend is a pure consumer — calls API through Nitro proxy (`/api/**`)
- Tokens stored in httpOnly cookies (not accessible to JS)
- SSR auth checks forward cookies from the incoming request to the API

## Tokens

| Token | Type | Lifetime | Storage |
|-------|------|----------|---------|
| Access token | JWT (`{ sub, email }`) | 15 minutes | httpOnly cookie, Path=/ |
| Refresh token | Opaque random string | 7 days | httpOnly cookie, Path=/ |

Both tokens are `Secure` in production and `SameSite=Lax`.

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/signup` | POST | Create user, issue token pair |
| `/auth/login` | POST | Verify credentials, issue token pair |
| `/auth/refresh` | POST | Rotate refresh token, issue new pair |
| `/auth/logout` | POST | Clear cookies, revoke token family (background) |
| `/auth/me` | GET | Return current user from access token |

## Token Rotation

Each login creates a **token family** (a UUID grouping all refresh tokens from one session).

**Refresh flow:**
1. Client sends refresh token (via cookie)
2. API finds the matching token by bcrypt comparison
3. If the token is revoked — **reuse detected** (see below)
4. Otherwise: revoke old token, issue new access + refresh token with the same family ID

**Reuse detection:**
When a revoked refresh token is used, it means the token was stolen and used after the legitimate user already rotated it. The API revokes **all tokens in that family**, killing that session entirely. Other sessions (other families) are unaffected.

## Password Storage

Passwords are hashed with bcrypt (12 rounds) via the `Password` value object. Raw passwords are never stored or logged.

## Frontend Integration

### API Proxy

The frontend proxies all API calls through Nitro to avoid cross-origin cookie issues:

```
Browser → localhost:3000/api/** → Nitro proxy → localhost:3030/**
```

Configured in `apps/web/vite.config.ts` via Nitro `routeRules`.

### Auth Check

`apps/web/src/lib/auth.ts` exports `getAuthUser()` — a TanStack Start server function that:
- On SSR: reads `access_token` cookie via `getCookie()` and calls the API directly
- On client: called via RPC, which forwards browser cookies to the server function

Used in route `beforeLoad` hooks:
- `/_app` layout — redirects to `/login` if not authenticated
- `/_auth` layout — redirects to `/dashboard` if already authenticated
- `/` index — redirects to `/dashboard` or `/login`

### Token Refresh

`apps/web/src/lib/api.ts` wraps `fetch` with automatic retry: if a request returns 401, it calls `/api/auth/refresh` first, then retries the original request.

### Logout

Logout clears cookies immediately and responds to the client. Token revocation (bcrypt-heavy) runs in the background without blocking the response.

## DDD Structure

```
apps/api/src/auth/
  domain/
    entities/         User, RefreshToken
    value-objects/    Email, Password, TokenFamily
    events/           UserRegistered, UserLoggedIn, TokensRefreshed, TokenReuseDetected
    repositories/     UserRepository, RefreshTokenRepository (abstract ports)
    errors/           InvalidCredentials, EmailAlreadyExists, TokenReuseDetected, etc.
  application/
    commands/         Signup, Login, RefreshTokens, Logout
    queries/          GetCurrentUser
    event-handlers/   TokenReuseDetectedHandler (logs warning)
  infrastructure/
    repositories/     Drizzle implementations of domain ports
    services/         JwtService, CookieService
    mappers/          DB row <-> domain entity
  presentation/
    auth.controller   5 endpoints, delegates to CommandBus/QueryBus
    auth.guard        Reads access_token cookie, verifies JWT
    auth.decorator    @CurrentUser() param decorator
    auth-exception    Maps domain errors to HTTP responses
    dto/              LoginDto, SignupDto (class-validator)
```

## Database

### `app.users`

| Column | Type |
|--------|------|
| id | uuid PK |
| email | varchar(255) unique |
| name | varchar(100) |
| password_hash | varchar(255) |
| created_at | timestamptz |
| updated_at | timestamptz |

### `app.refresh_tokens`

| Column | Type |
|--------|------|
| id | uuid PK |
| user_id | uuid FK -> users (cascade delete) |
| token_hash | varchar(255) — bcrypt hash of raw token |
| family_id | uuid — groups tokens from one session |
| revoked | boolean |
| expires_at | timestamptz |
| created_at | timestamptz |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | — | Signing key (min 32 chars) |
| `JWT_EXPIRATION` | `15m` | Access token lifetime |
| `REFRESH_TOKEN_EXPIRATION` | `7d` | Refresh token lifetime |
| `WEB_URL` | `http://localhost:3000` | Frontend origin for CORS |
