CREATE TABLE "search_misses" (
	"query" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "search_misses_last_seen_idx" ON "search_misses" USING btree ("last_seen_at");