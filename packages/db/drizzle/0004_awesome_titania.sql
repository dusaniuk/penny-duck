ALTER TABLE "app"."accounts" ALTER COLUMN "balance" SET DATA TYPE integer USING ("balance" * 100)::integer;--> statement-breakpoint
ALTER TABLE "app"."transactions" ALTER COLUMN "amount" SET DATA TYPE integer USING ("amount" * 100)::integer;--> statement-breakpoint
ALTER TABLE "app"."transactions" ALTER COLUMN "my_share" SET DATA TYPE integer USING ("my_share" * 100)::integer;--> statement-breakpoint
ALTER TABLE "app"."transactions" ALTER COLUMN "original_amount" SET DATA TYPE integer USING ("original_amount" * 100)::integer;--> statement-breakpoint
ALTER TABLE "app"."transactions" ALTER COLUMN "exchange_rate" SET DATA TYPE integer USING ("exchange_rate" * 1000000)::integer;
