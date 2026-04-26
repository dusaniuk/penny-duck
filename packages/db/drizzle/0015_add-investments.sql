CREATE TABLE "app"."instruments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"name" varchar(200) NOT NULL,
	"exchange" varchar(20),
	"currency" varchar(3) NOT NULL,
	"last_price" integer DEFAULT 0 NOT NULL,
	"last_priced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."trades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"instrument_id" uuid NOT NULL,
	"type" varchar(10) NOT NULL,
	"quantity" numeric(18, 8),
	"price" integer,
	"amount" integer NOT NULL,
	"fees" integer DEFAULT 0 NOT NULL,
	"withheld_tax" integer,
	"date" timestamp with time zone NOT NULL,
	"external_source" text,
	"external_id" text,
	"external_metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."accounts"
ADD COLUMN "external_account_id" text;
--> statement-breakpoint
ALTER TABLE "app"."trades"
ADD CONSTRAINT "trades_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "app"."organizations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "app"."trades"
ADD CONSTRAINT "trades_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "app"."accounts"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "app"."trades"
ADD CONSTRAINT "trades_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "app"."instruments"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "instruments_symbol_idx" ON "app"."instruments" USING btree ("symbol");
--> statement-breakpoint
CREATE INDEX "instruments_last_priced_at_idx" ON "app"."instruments" USING btree ("last_priced_at");
--> statement-breakpoint
CREATE INDEX "trades_org_date_idx" ON "app"."trades" USING btree ("organization_id", "date");
--> statement-breakpoint
CREATE INDEX "trades_account_instrument_date_idx" ON "app"."trades" USING btree ("account_id", "instrument_id", "date");
--> statement-breakpoint
CREATE UNIQUE INDEX "trades_external_id_unique" ON "app"."trades" USING btree ("account_id", "external_source", "external_id")
WHERE "app"."trades"."external_id" IS NOT NULL;