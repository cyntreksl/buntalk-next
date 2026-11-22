CREATE TYPE "public"."order_status" AS ENUM('pending', 'confirmed', 'preparing', 'ready', 'dispatched', 'completed', 'cancelled');--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "status" "order_status";--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "status_changed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "status_checked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "access_token" uuid DEFAULT gen_random_uuid() NOT NULL;