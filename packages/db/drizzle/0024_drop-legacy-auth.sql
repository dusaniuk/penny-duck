DROP TABLE "app"."refresh_tokens" CASCADE;--> statement-breakpoint
ALTER TABLE "app"."users" DROP COLUMN "password_hash";