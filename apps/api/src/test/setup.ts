import { Test } from "@nestjs/testing"
import { type INestApplication } from "@nestjs/common"
import { CommandBus, QueryBus } from "@nestjs/cqrs"
import { sql } from "drizzle-orm"
import { type DbClient } from "@workspace/db"
import { faker } from "@faker-js/faker"
import { AppModule } from "../app.module"
import { DB_CLIENT } from "../database/database.module"
import { SignupCommand } from "../auth/application/commands/signup.command"
import { LoginCommand } from "../auth/application/commands/login.command"

let app: INestApplication
let commandBus: CommandBus
let queryBus: QueryBus
let db: DbClient

export async function createTestApp(): Promise<{
  app: INestApplication
  commandBus: CommandBus
  queryBus: QueryBus
  db: DbClient
}> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile()

  app = moduleRef.createNestApplication()
  await app.init()

  commandBus = app.get(CommandBus)
  queryBus = app.get(QueryBus)
  db = moduleRef.get(DB_CLIENT)

  return { app, commandBus, queryBus, db }
}

export async function closeTestApp() {
  if (app) await app.close()
  if (db) await db.$client.end()
}

export async function truncateAll() {
  if (!process.env.DATABASE_URL?.includes("test")) {
    throw new Error(
      "Refusing to truncate: DATABASE_URL does not contain 'test'"
    )
  }
  await db.execute(
    sql`TRUNCATE app.transactions, app.categories, app.accounts, app.refresh_tokens, app.users CASCADE`
  )
}

export async function flushEvents(ms = 100) {
  await new Promise((r) => setTimeout(r, ms))
}

export async function signupUser(
  overrides?: Partial<{ name: string; email: string; password: string }>
) {
  const email = overrides?.email ?? faker.internet.email()
  const password = overrides?.password ?? faker.internet.password({ length: 16 })

  await commandBus.execute(
    new SignupCommand(
      overrides?.name ?? faker.person.fullName(),
      email,
      password
    )
  )

  return commandBus.execute(new LoginCommand(email, password))
}
