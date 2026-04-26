import { index, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core"
import { appSchema } from "./schema"
import { organizations } from "./organizations"
import { money } from "./custom-types"

export const accounts = appSchema.table(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    type: varchar("type", { length: 20 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    initialBalance: money("initial_balance").notNull().default(0),
    externalAccountId: text("external_account_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("accounts_org_idx").on(table.organizationId)]
)
