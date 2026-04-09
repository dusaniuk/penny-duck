import { timestamp, uuid, varchar } from "drizzle-orm/pg-core"
import { appSchema } from "./schema"
import { users } from "./users"
import { money } from "./custom-types"

export const accounts = appSchema.table("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  type: varchar("type", { length: 20 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  balance: money("balance").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})
