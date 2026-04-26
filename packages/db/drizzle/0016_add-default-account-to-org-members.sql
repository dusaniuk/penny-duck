ALTER TABLE "app"."organization_members" ADD COLUMN "default_account_id" uuid;--> statement-breakpoint
ALTER TABLE "app"."organization_members" ADD CONSTRAINT "organization_members_default_account_id_accounts_id_fk" FOREIGN KEY ("default_account_id") REFERENCES "app"."accounts"("id") ON DELETE set null ON UPDATE no action;
