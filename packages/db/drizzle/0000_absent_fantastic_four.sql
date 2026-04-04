-- Handle existing dev database state
DROP TABLE IF EXISTS "app"."auth_providers";
--> statement-breakpoint
ALTER TABLE "app"."users" ADD COLUMN IF NOT EXISTS "password_hash" varchar(255) NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE "app"."users" ALTER COLUMN "password_hash" DROP DEFAULT;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app"."refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"family_id" uuid NOT NULL,
	"revoked" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "app"."refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
