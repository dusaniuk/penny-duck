ALTER TABLE "app"."transactions" ADD COLUMN "reimbursement_id" uuid;--> statement-breakpoint
ALTER TABLE "app"."transactions" ADD CONSTRAINT "transactions_reimbursement_id_transactions_id_fk" FOREIGN KEY ("reimbursement_id") REFERENCES "app"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "transactions_reimbursement_id_idx" ON "app"."transactions" USING btree ("reimbursement_id");--> statement-breakpoint
ALTER TABLE "app"."transactions" DROP COLUMN "my_share";