CREATE TABLE "app"."transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"type" varchar(20) NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"category_id" uuid,
	"note" varchar(500),
	"date" timestamp with time zone NOT NULL,
	"my_share" numeric(12, 2),
	"settled" boolean DEFAULT true NOT NULL,
	"original_amount" numeric(12, 2),
	"original_currency" varchar(3),
	"exchange_rate" numeric(12, 6),
	"transfer_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."transactions" ADD CONSTRAINT "transactions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "app"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."transactions" ADD CONSTRAINT "transactions_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "app"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transactions_user_date_idx" ON "app"."transactions" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "transactions_account_date_idx" ON "app"."transactions" USING btree ("account_id","date");--> statement-breakpoint
CREATE INDEX "transactions_transfer_id_idx" ON "app"."transactions" USING btree ("transfer_id");--> statement-breakpoint
CREATE INDEX "transactions_user_settled_idx" ON "app"."transactions" USING btree ("user_id","settled");