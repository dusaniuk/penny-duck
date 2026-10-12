import { boolean, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core"
import { appSchema } from "./schema"

export const users = appSchema.table("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  name: varchar("name", { length: 100 }).notNull(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  homeCurrency: varchar("home_currency", { length: 3 })
    .notNull()
    .default("UAH"),
  agreedToTermsAt: timestamp("agreed_to_terms_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
})
