import {
  date,
  index,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"
import { appSchema } from "./schema"
import { rate } from "./custom-types"

export const exchangeRates = appSchema.table(
  "exchange_rates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    date: date("date", { mode: "string" }).notNull(),
    base: varchar("base", { length: 3 }).notNull(),
    target: varchar("target", { length: 3 }).notNull(),
    rate: rate("rate").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("exchange_rates_date_base_target_idx").on(
      table.date,
      table.base,
      table.target
    ),
    index("exchange_rates_date_base_idx").on(table.date, table.base),
  ]
)
