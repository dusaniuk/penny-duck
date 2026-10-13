DROP INDEX "app"."wallet_inbox_dedupe_uq";--> statement-breakpoint
ALTER TABLE "app"."wallet_inbox" ALTER COLUMN "currency" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."wallet_inbox" ADD CONSTRAINT "wallet_inbox_dedupe_uq" UNIQUE NULLS NOT DISTINCT("organization_id","card","amount","currency","occurred_at");