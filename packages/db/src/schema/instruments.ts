import {
  index,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"
import { appSchema } from "./schema"
import { money } from "./custom-types"

export const instruments = appSchema.table(
  "instruments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    symbol: varchar("symbol", { length: 20 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    exchange: varchar("exchange", { length: 20 }),
    currency: varchar("currency", { length: 3 }).notNull(),
    lastPrice: money("last_price").notNull().default(0),
    lastPricedAt: timestamp("last_priced_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("instruments_symbol_idx").on(table.symbol),
    index("instruments_last_priced_at_idx").on(table.lastPricedAt),
  ]
)
