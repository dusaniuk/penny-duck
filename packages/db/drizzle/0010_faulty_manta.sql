CREATE TABLE "app"."exchange_rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"base" varchar(3) NOT NULL,
	"target" varchar(3) NOT NULL,
	"rate" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exchange_rates_date_base_target_idx" UNIQUE("date","base","target")
);
--> statement-breakpoint
CREATE INDEX "exchange_rates_date_base_idx" ON "app"."exchange_rates" USING btree ("date","base");