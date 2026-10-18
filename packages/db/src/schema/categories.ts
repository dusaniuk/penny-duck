import { sql } from "drizzle-orm"
import {
  index,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core"
import { appSchema } from "./schema"
import { organizations } from "./organizations"

export const categories = appSchema.table(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    name: varchar("name", { length: 100 }).notNull(),
    type: varchar("type", { length: 20 }).notNull().default("expense"),
    icon: varchar("icon", { length: 50 }),
    color: varchar("color", { length: 20 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    index("categories_org_idx").on(table.organizationId),
    uniqueIndex("categories_top_level_name_uq")
      .on(table.organizationId, table.type, sql`lower(${table.name})`)
      .where(sql`parent_id is null and archived_at is null`),
    uniqueIndex("categories_child_name_uq")
      .on(table.parentId, sql`lower(${table.name})`)
      .where(sql`parent_id is not null and archived_at is null`),
  ]
)
