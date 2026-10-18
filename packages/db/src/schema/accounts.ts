import { sql } from "drizzle-orm"
import {
  index,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"
import { appSchema } from "./schema"
import { organizations } from "./organizations"
import { money } from "./custom-types"
import { wallets } from "./wallets"

export const accounts = appSchema.table(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    walletId: uuid("wallet_id").references(() => wallets.id, {
      onDelete: "cascade",
    }),
    name: varchar("name", { length: 100 }).notNull(),
    type: varchar("type", { length: 20 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    color: varchar("color", { length: 20 }),
    icon: varchar("icon", { length: 50 }),
    initialBalance: money("initial_balance").notNull().default(0),
    externalAccountId: text("external_account_id"),
    cardLabel: varchar("card_label", { length: 100 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    index("accounts_org_idx").on(table.organizationId),
    uniqueIndex("accounts_wallet_currency_uq")
      .on(table.walletId, table.currency)
      .where(sql`wallet_id is not null`),
    uniqueIndex("accounts_org_name_uq")
      .on(table.organizationId, sql`lower(${table.name})`)
      .where(sql`wallet_id is null and archived_at is null`),
  ]
)
