import {
  boolean,
  decimal,
  index,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"
import { appSchema } from "./schema"
import { users } from "./users"
import { accounts } from "./accounts"
import { categories } from "./categories"

export const transactions = appSchema.table(
  "transactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: uuid("account_id").references(() => accounts.id, {
      onDelete: "set null",
    }),
    type: varchar("type", { length: 20 }).notNull(),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    note: varchar("note", { length: 500 }),
    date: timestamp("date", { withTimezone: true }).notNull(),
    myShare: decimal("my_share", { precision: 12, scale: 2 }),
    settled: boolean("settled").notNull().default(true),
    originalAmount: decimal("original_amount", { precision: 12, scale: 2 }),
    originalCurrency: varchar("original_currency", { length: 3 }),
    exchangeRate: decimal("exchange_rate", { precision: 12, scale: 6 }),
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
