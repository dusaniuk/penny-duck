CREATE TABLE "app"."wallets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"color" varchar(20),
	"icon" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."accounts" ADD COLUMN "wallet_id" uuid;--> statement-breakpoint
ALTER TABLE "app"."wallets" ADD CONSTRAINT "wallets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wallets_org_idx" ON "app"."wallets" USING btree ("organization_id");--> statement-breakpoint
ALTER TABLE "app"."accounts" ADD CONSTRAINT "accounts_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "app"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_wallet_currency_uq" ON "app"."accounts" USING btree ("wallet_id","currency") WHERE wallet_id is not null;