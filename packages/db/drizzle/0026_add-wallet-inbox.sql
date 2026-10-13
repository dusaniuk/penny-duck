CREATE TABLE "app"."wallet_inbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid,
	"card" varchar(100) NOT NULL,
	"merchant" varchar(200),
	"description" varchar(500),
	"amount" integer NOT NULL,
	"currency" varchar(3) NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"transaction_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."accounts" ADD COLUMN "card_label" varchar(100);--> statement-breakpoint
ALTER TABLE "app"."wallet_inbox" ADD CONSTRAINT "wallet_inbox_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."wallet_inbox" ADD CONSTRAINT "wallet_inbox_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."wallet_inbox" ADD CONSTRAINT "wallet_inbox_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "app"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."wallet_inbox" ADD CONSTRAINT "wallet_inbox_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "app"."transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "wallet_inbox_org_status_created_idx" ON "app"."wallet_inbox" USING btree ("organization_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_inbox_dedupe_uq" ON "app"."wallet_inbox" USING btree ("organization_id","card","amount","currency","occurred_at");