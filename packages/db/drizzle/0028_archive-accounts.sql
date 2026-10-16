ALTER TABLE "app"."accounts" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app"."wallets" ADD COLUMN "archived_at" timestamp with time zone;