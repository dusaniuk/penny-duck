import { sql } from "drizzle-orm"
import { faker } from "@faker-js/faker"
import { type DbClient } from "@workspace/db"
import { db } from "@/db"
import { honoApp } from "@/app"
import { auth } from "@/modules/auth/auth"

export async function createTestApp(): Promise<{ db: DbClient }> {
  return { db }
}

export async function closeTestApp() {
  // No-op under bun test: all spec files share the singleton db pool in a
  // single process, so ending it after one file's afterAll would break later
  // files. Process exit cleans up the connection.
}

export async function truncateAll() {
  if (!process.env.DATABASE_URL?.includes("test")) {
    throw new Error(
      "Refusing to truncate: DATABASE_URL does not contain 'test'"
    )
  }
  await db.execute(
    sql`TRUNCATE app.wallet_inbox, app.trades, app.instrument_prices, app.instruments, app.exchange_rates, app.transactions, app.categories, app.accounts, app.organization_members, app.organizations, auth.verifications, auth.apikeys, app.users CASCADE`
  )
}

export async function flushEvents(ms = 100) {
  await new Promise((r) => setTimeout(r, ms))
}

export interface TestUser {
  userId: string
  email: string
  name: string
  password: string
  organizationId: string
  cookie: string
}

export async function signupUser(
  overrides?: Partial<{
    name: string
    email: string
    password: string
    inviteCode: string
  }>
): Promise<TestUser> {
  const name = overrides?.name ?? faker.person.fullName()
  const email = (overrides?.email ?? faker.internet.email()).toLowerCase()
  const password =
    overrides?.password ?? faker.internet.password({ length: 16 })

  const res = await honoApp.request("/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      name,
      email,
      password,
      ...(overrides?.inviteCode ? { inviteCode: overrides.inviteCode } : {}),
    }),
  })
  if (res.status !== 200) {
    throw new Error(`signupUser failed: ${res.status} ${await res.text()}`)
  }

  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ")
  const session = await auth.api.getSession({
    headers: new Headers({ cookie }),
  })
  const organizationId = session?.session.activeOrganizationId
  if (!session || typeof organizationId !== "string") {
    throw new Error("signupUser: session has no active organization")
  }

  return {
    userId: session.user.id,
    email,
    name,
    password,
    organizationId,
    cookie,
  }
}
