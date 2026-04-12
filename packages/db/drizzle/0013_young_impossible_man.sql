TRUNCATE TABLE "app"."refresh_tokens";--> statement-breakpoint
ALTER TABLE "app"."refresh_tokens" ADD COLUMN "token" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."refresh_tokens" DROP COLUMN "token_hash";--> statement-breakpoint
ALTER TABLE "app"."refresh_tokens" DROP COLUMN "family_id";--> statement-breakpoint
ALTER TABLE "app"."refresh_tokens" DROP COLUMN "revoked";--> statement-breakpoint
ALTER TABLE "app"."refresh_tokens" ADD CONSTRAINT "refresh_tokens_token_unique" UNIQUE("token");