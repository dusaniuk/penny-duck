-- 1. Create organizations table
CREATE TABLE IF NOT EXISTS "app"."organizations" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(100) NOT NULL,
  "invite_code" varchar(6),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "organizations_invite_code_unique" UNIQUE("invite_code")
);

-- 2. Create organization_members table
CREATE TABLE IF NOT EXISTS "app"."organization_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "role" varchar(20) NOT NULL,
  "joined_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "organization_members_organization_id_user_id_unique" UNIQUE("organization_id","user_id")
);

ALTER TABLE "app"."organization_members"
  ADD CONSTRAINT "organization_members_organization_id_organizations_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "app"."organization_members"
  ADD CONSTRAINT "organization_members_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "app"."users"("id")
  ON DELETE cascade ON UPDATE no action;

-- 3+4. Backfill: create org + owner membership for every user
DO $$
DECLARE
  r RECORD;
  org_id uuid;
BEGIN
  FOR r IN SELECT id, name, created_at FROM app.users LOOP
    INSERT INTO app.organizations (id, name, created_at)
    VALUES (gen_random_uuid(), r.name || '''s Space', r.created_at)
    RETURNING id INTO org_id;

    INSERT INTO app.organization_members (id, organization_id, user_id, role)
    VALUES (gen_random_uuid(), org_id, r.id, 'owner');
  END LOOP;
END $$;

-- 5. Add organization_id column to data tables (nullable first)
ALTER TABLE "app"."accounts" ADD COLUMN "organization_id" uuid;
ALTER TABLE "app"."categories" ADD COLUMN "organization_id" uuid;
ALTER TABLE "app"."transactions" ADD COLUMN "organization_id" uuid;

-- 6. Backfill organization_id from user's org membership
UPDATE "app"."accounts" a
SET "organization_id" = om."organization_id"
FROM "app"."organization_members" om
WHERE om."user_id" = a."user_id";

UPDATE "app"."categories" c
SET "organization_id" = om."organization_id"
FROM "app"."organization_members" om
WHERE om."user_id" = c."user_id";

UPDATE "app"."transactions" t
SET "organization_id" = om."organization_id"
FROM "app"."organization_members" om
WHERE om."user_id" = t."user_id";

-- 7. Make organization_id NOT NULL
ALTER TABLE "app"."accounts" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "app"."categories" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "app"."transactions" ALTER COLUMN "organization_id" SET NOT NULL;

-- 8. Add foreign key constraints
ALTER TABLE "app"."accounts"
  ADD CONSTRAINT "accounts_organization_id_organizations_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "app"."categories"
  ADD CONSTRAINT "categories_organization_id_organizations_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id")
  ON DELETE cascade ON UPDATE no action;

ALTER TABLE "app"."transactions"
  ADD CONSTRAINT "transactions_organization_id_organizations_id_fk"
  FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id")
  ON DELETE cascade ON UPDATE no action;

-- 9. Drop old userId indexes on transactions
DROP INDEX IF EXISTS "app"."transactions_user_date_idx";
DROP INDEX IF EXISTS "app"."transactions_user_settled_idx";

-- 10. Drop old user_id foreign keys
ALTER TABLE "app"."accounts" DROP CONSTRAINT "accounts_user_id_users_id_fk";
ALTER TABLE "app"."categories" DROP CONSTRAINT "categories_user_id_users_id_fk";
ALTER TABLE "app"."transactions" DROP CONSTRAINT "transactions_user_id_users_id_fk";

-- 11. Drop user_id columns
ALTER TABLE "app"."accounts" DROP COLUMN "user_id";
ALTER TABLE "app"."categories" DROP COLUMN "user_id";
ALTER TABLE "app"."transactions" DROP COLUMN "user_id";

-- 12. Create new indexes
CREATE INDEX "accounts_org_idx" ON "app"."accounts" USING btree ("organization_id");
CREATE INDEX "categories_org_idx" ON "app"."categories" USING btree ("organization_id");
CREATE INDEX "organization_members_user_id_idx" ON "app"."organization_members" USING btree ("user_id");
CREATE INDEX "transactions_org_date_idx" ON "app"."transactions" USING btree ("organization_id","date");
CREATE INDEX "transactions_org_settled_idx" ON "app"."transactions" USING btree ("organization_id","settled");
