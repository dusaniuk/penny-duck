import { date, index, primaryKey, uuid } from "drizzle-orm/pg-core"
import { appSchema } from "./schema"
import { instruments } from "./instruments"
import { money } from "./custom-types"

export const instrumentPrices = appSchema.table(
  "instrument_prices",
  {
    instrumentId: uuid("instrument_id")
      .notNull()
      .references(() => instruments.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    close: money("close").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.instrumentId, table.date] }),
    index("instrument_prices_instrument_date_desc_idx").on(
      table.instrumentId,
      table.date.desc()
    ),
  ]
)
