import { index, timestamp, unique, uuid, varchar } from "drizzle-orm/pg-core"
import { appSchema } from "./schema"
import { organizations } from "./organizations"
import { users } from "./users"

export const organizationMembers = appSchema.table(
  "organization_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 20 }).notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique().on(table.organizationId, table.userId),
    index("organization_members_user_id_idx").on(table.userId),
  ]
)
