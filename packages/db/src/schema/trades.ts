import {
  index,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { appSchema } from "./schema"
import { organizations } from "./organizations"
import { accounts } from "./accounts"
import { instruments } from "./instruments"
import { money, quantity } from "./custom-types"

export const trades = appSchema.table(
  "trades",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    instrumentId: uuid("instrument_id")
      .notNull()
      .references(() => instruments.id, { onDelete: "restrict" }),
    type: varchar("type", { length: 10 }).notNull(),
    quantity: quantity("quantity"),
    price: money("price"),
    amount: money("amount").notNull(),
    fees: money("fees").notNull().default(0),
    withheldTax: money("withheld_tax"),
    date: timestamp("date", { withTimezone: true }).notNull(),
    externalSource: text("external_source"),
    externalId: text("external_id"),
    externalMetadata: jsonb("external_metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("trades_org_date_idx").on(table.organizationId, table.date),
    index("trades_account_instrument_date_idx").on(
      table.accountId,
      table.instrumentId,
      table.date
    ),
    uniqueIndex("trades_external_id_unique")
      .on(table.accountId, table.externalSource, table.externalId)
      .where(sql`${table.externalId} IS NOT NULL`),
  ]
)
