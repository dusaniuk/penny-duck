CREATE TABLE "app"."instrument_prices" (
	"instrument_id" uuid NOT NULL,
	"date" date NOT NULL,
	"close" integer NOT NULL,
	CONSTRAINT "instrument_prices_instrument_id_date_pk" PRIMARY KEY("instrument_id","date")
);
--> statement-breakpoint
ALTER TABLE "app"."instrument_prices" ADD CONSTRAINT "instrument_prices_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "app"."instruments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "instrument_prices_instrument_date_desc_idx" ON "app"."instrument_prices" USING btree ("instrument_id","date" DESC NULLS LAST);