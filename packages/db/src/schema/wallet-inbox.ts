import {
  index,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"
import { appSchema } from "./schema"
import { organizations } from "./organizations"
import { users } from "./users"
import { accounts } from "./accounts"
import { transactions } from "./transactions"
import { money } from "./custom-types"

export const walletInbox = appSchema.table(
  "wallet_inbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: uuid("account_id").references(() => accounts.id, {
      onDelete: "set null",
    }),
    card: varchar("card", { length: 100 }).notNull(),
    merchant: varchar("merchant", { length: 200 }),
    description: varchar("description", { length: 500 }),
    amount: money("amount").notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    transactionId: uuid("transaction_id").references(() => transactions.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("wallet_inbox_org_status_created_idx").on(
      table.organizationId,
      table.status,
      table.createdAt
    ),
    uniqueIndex("wallet_inbox_dedupe_uq").on(
      table.organizationId,
      table.card,
      table.amount,
      table.currency,
      table.occurredAt
    ),
  ]
)
