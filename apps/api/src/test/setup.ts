import { sql } from "drizzle-orm"
import { faker } from "@faker-js/faker"
import { type DbClient } from "@workspace/db"
import { db } from "@/db"
import {
  loginService,
  signupService,
} from "@/modules/auth/service"

export async function createTestApp(): Promise<{ db: DbClient }> {
  return { db }
}

export async function closeTestApp() {
  await db.$client.end()
}

export async function truncateAll() {
  if (!process.env.DATABASE_URL?.includes("test")) {
    throw new Error(
      "Refusing to truncate: DATABASE_URL does not contain 'test'"
    )
  }
  await db.execute(
    sql`TRUNCATE app.trades, app.instruments, app.exchange_rates, app.transactions, app.categories, app.accounts, app.organization_members, app.organizations, app.refresh_tokens, app.users CASCADE`
  )
}

export async function flushEvents(ms = 100) {
  await new Promise((r) => setTimeout(r, ms))
}

export async function signupUser(
  overrides?: Partial<{
    name: string
    email: string
    password: string
    inviteCode: string
  }>,
) {
  const email = overrides?.email ?? faker.internet.email()
  const password =
    overrides?.password ?? faker.internet.password({ length: 16 })

  await signupService({
    name: overrides?.name ?? faker.person.fullName(),
    email,
    password,
    inviteCode: overrides?.inviteCode,
  })

  return loginService(email, password)
}
