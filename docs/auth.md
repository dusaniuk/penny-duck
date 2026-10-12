# Authentication

Self-hosted [Better Auth](https://www.better-auth.com) 1.7 running inside the Hono API. Sessions are database records referenced by an httpOnly cookie. Email + password and (optionally) Google sign-in are supported.

## Overview

- The single auth config is `apps/api/src/modules/auth/auth.ts`; organization provisioning lives in its `databaseHooks`
- `honoAuthMiddleware` (`apps/api/src/middleware/auth.ts`) calls `auth.api.getSession()` for protected routes and answers 401 when there is no session or the session has no active organization
- The frontend is a pure consumer: `apps/web/src/lib/auth-client.ts` (`better-auth/react`, `basePath: "/api/auth"`) talks to the API through the Nitro proxy
- SSR auth checks forward the incoming request cookie to the API

## Mounting and the `/api` rewrite

Better Auth is mounted in `apps/api/src/app.ts` at `/auth/*` (GET and POST). The handler rewrites the path to `/api/auth/*` before passing the request on.

Why: Better Auth's router matches `baseURL + basePath`, i.e. `/api/auth`. The browser calls `/api/auth/...`, but the Nitro proxy strips the `/api` prefix, so the Hono API only sees `/auth/...`. Re-adding the prefix lets Better Auth match its routes.

```
Browser -> /api/auth/sign-in/email -> Nitro proxy -> API /auth/sign-in/email -> rewritten to /api/auth/sign-in/email
```

Common endpoints (relative to the API): `POST /auth/sign-up/email`, `POST /auth/sign-in/email`, `POST /auth/sign-out`, `POST /auth/sign-in/social`, `GET /auth/callback/google`. The current user is returned by `GET /users/me`.

## Database

Better Auth tables live in the Postgres schema `auth`:

| Table | Purpose |
|-------|---------|
| `auth.sessions` | One row per session: `token`, `expires_at`, `ip_address`, `user_agent`, `active_organization_id` (FK to `app.organizations`, `ON DELETE SET NULL`). Cascades from `app.users` |
| `auth.accounts` | Credential password hashes (`provider_id = 'credential'`) and Google accounts. OAuth tokens are stored encrypted. Cascades from `app.users` |
| `auth.verifications` | Short-lived verification/OAuth state records |

`app.users` is the Better Auth user table. Additional fields on top of the standard ones:

- `homeCurrency` (`home_currency`) and `agreedToTermsAt` (`agreed_to_terms_at`); neither is settable from client input
- `email_verified` and `image` exist for Better Auth but `image` is always null (Google profile photos are not stored)

Schema definitions: `packages/db/src/schema/auth.ts` and `users.ts`. Migration `0023_better-auth` copied existing password hashes into `auth.accounts` and marked existing users email-verified; `0024_drop-legacy-auth` dropped `app.users.password_hash` and `app.refresh_tokens`.

## Sessions

| Setting | Value |
|---------|-------|
| Cookie | `penny-duck.session_token`, httpOnly (`__Secure-` prefix over https) |
| Lifetime | 7 days (`expiresIn`) |
| Sliding refresh | Expiry is extended at most once a day (`updateAge` = 1 day) |
| Cookie cache | 5-minute signed `penny-duck.session_data` cookie (`cookieCache.maxAge` = 300) |

The cookie cache avoids a database lookup on every request. Caveat: a session that is revoked (for example by signing out on another device) can keep working on a device that still holds a valid cache cookie for up to 5 minutes.

Sign-out is handled by Better Auth's `/auth/sign-out`, which clears the session cookies. `clearSessionCookies` (`apps/api/src/modules/auth/cookies.ts`) is only used by `DELETE /users/me`.

Better Auth's `/update-user` endpoint is disabled (`disabledPaths`); profiles are edited through `PATCH /users/me`, which applies the app's validation.

## Organization provisioning

Every session must have an `activeOrganizationId`.

- `databaseHooks.session.create.before` looks up the user's membership. If there is none it provisions one: join the invited organization as `member` when an invite code is present, otherwise create a `"<name>'s Space"` organization with the user as `owner`. The organization id is stored on the session as `activeOrganizationId`
- `databaseHooks.user.create.before` validates the name (at most 100 characters, error `NAME_TOO_LONG`) and the invite code (error `INVALID_INVITE`), and sets `agreedToTermsAt`

## Invite codes

- `GET /invites/:code` looks up an invite (404 for an invalid code); `POST /invites` generates an invite code for the caller's organization (owner only)
- The invite code is passed as `inviteCode` in the email sign-up body, or, for Google, as `additionalData.inviteCode` on the OAuth sign-in request. Both are read by `readInviteCode` in `apps/api/src/modules/auth/organization.ts`

## Passwords

New passwords are hashed with scrypt (Better Auth's default). Legacy bcrypt hashes migrated from the old system (prefix `$2`) still verify through the custom `verify` in `apps/api/src/modules/auth/password.ts`.

## Google sign-in

- Enabled only when both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set
- Redirect URI to register in Google Cloud Console: `${WEB_URL}/api/auth/callback/google` (locally `http://localhost:3000/api/auth/callback/google`)
- `prompt: select_account`
- The profile photo is not stored (`mapGoogleProfile` in `google.ts` drops it); a missing name falls back to "Google user" and names are truncated to 100 characters
- Account linking: signing in with Google links to an existing user with the same email only when that account's email is verified. Existing and migrated users are; users who signed up with email after the migration are not, so linking is refused (`account_not_linked`) and the login page tells them to use their password
- OAuth tokens are stored encrypted (`account.encryptOAuthTokens`)
- API errors redirect to `${WEB_URL}/login` (`onAPIError.errorURL`)

## Rate limits

Enabled in production only, in-memory storage, per client IP (taken from `x-forwarded-for`):

| Endpoint | Limit |
|----------|-------|
| `/sign-in/email` | 5 per minute |
| `/sign-up/email` | 3 per minute |

Because storage is in memory, limits are per API process and reset on restart.

Better Auth 1.7.7 reads the client IP from `x-forwarded-for` only when the header holds a single value. With several values (a proxy chain) and no `trustedProxies` configured, it cannot determine the IP and the request falls into a shared bucket. After deploying, check the production logs for "Rate limiting could not determine a client IP".

## Frontend integration

### API proxy

```
Browser -> localhost:3000/api/** -> Nitro proxy -> localhost:3030/**
```

Configured in `apps/web/vite.config.ts` via Nitro `routeRules`, so cookies stay same-origin. The rule sets `fetchOptions: { redirect: "manual" }` so upstream redirects (the Google OAuth callback's `302` plus `Set-Cookie`) reach the browser instead of being followed by the proxy.

### Auth check

`apps/web/src/lib/auth.ts` exports `getAuthUser()`, a TanStack Start server function that forwards the request cookie to `/users/me` and forwards any `Set-Cookie` header from the response back to the browser.

Used in route `beforeLoad` hooks:
- `/_app` layout redirects to `/login` if not authenticated
- `/_auth` layout redirects to `/dashboard` if already authenticated
- `/` index redirects to `/dashboard` or `/login`

## Environment variables (API)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | yes | Postgres connection string |
| `BETTER_AUTH_SECRET` | yes | Signing/encryption secret, at least 32 characters (`openssl rand -base64 32`) |
| `WEB_URL` | yes | Public web origin; used as Better Auth `baseURL`, trusted origin and CORS origin |
| `PORT` | no | API port (3030) |
| `GOOGLE_CLIENT_ID` | no | Enables Google sign-in together with the secret |
| `GOOGLE_CLIENT_SECRET` | no | See above |

`JWT_SECRET`, `JWT_EXPIRATION` and `REFRESH_TOKEN_EXPIRATION` are no longer used.
