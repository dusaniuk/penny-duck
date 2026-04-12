ALTER TABLE "app"."transactions" ADD COLUMN "made_by_id" uuid;--> statement-breakpoint
ALTER TABLE "app"."transactions" ADD CONSTRAINT "transactions_made_by_id_users_id_fk" FOREIGN KEY ("made_by_id") REFERENCES "app"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
UPDATE "app"."transactions" t
SET "made_by_id" = (
  SELECT om."user_id"
  FROM "app"."organization_members" om
  WHERE om."organization_id" = t."organization_id"
    AND om."role" = 'owner'
  LIMIT 1
);--> statement-breakpoint
CREATE INDEX "transactions_made_by_id_idx" ON "app"."transactions" USING btree ("made_by_id");