CREATE TYPE "public"."order_erp_status" AS ENUM('pending', 'submitting', 'submitted', 'failed', 'rejected');--> statement-breakpoint
CREATE TABLE "order_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"type" text NOT NULL,
	"message" text,
	"data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"customer" jsonb NOT NULL,
	"fulfilment" jsonb NOT NULL,
	"lines" jsonb NOT NULL,
	"applied_schemes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"free_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"payment" jsonb NOT NULL,
	"note" text,
	"currency" text NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL,
	"discount_total" numeric(12, 2) NOT NULL,
	"delivery_fee" numeric(12, 2) NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"erp_status" "order_erp_status" DEFAULT 'pending' NOT NULL,
	"erp_order_id" text,
	"erp_order_number" text,
	"erp_customer_id" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"next_attempt_at" timestamp with time zone DEFAULT now(),
	"locked_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_number_unique" UNIQUE("number"),
	CONSTRAINT "orders_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "order_events_order_idx" ON "order_events" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "orders_retry_idx" ON "orders" USING btree ("erp_status","next_attempt_at");