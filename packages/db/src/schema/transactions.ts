import {
  boolean,
  index,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"
import { appSchema } from "./schema"
import { users } from "./users"
import { accounts } from "./accounts"
import { categories } from "./categories"
import { money, rate } from "./custom-types"

export const transactions = appSchema.table(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: uuid("account_id")
      .notNull()
      .references(() => accounts.id, {
        onDelete: "restrict",
      }),
    amount: money("amount").notNull(),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    note: varchar("note", { length: 500 }),
    date: timestamp("date", { withTimezone: true }).notNull(),
    myShare: money("my_share"),
    settled: boolean("settled").notNull().default(true),
    originalAmount: money("original_amount"),
    originalCurrency: varchar("original_currency", { length: 3 }),
    exchangeRate: rate("exchange_rate"),
    transferId: uuid("transfer_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("transactions_user_date_idx").on(table.userId, table.date),
    index("transactions_account_date_idx").on(table.accountId, table.date),
    index("transactions_transfer_id_idx").on(table.transferId),
    index("transactions_user_settled_idx").on(table.userId, table.settled),
  ]
)
