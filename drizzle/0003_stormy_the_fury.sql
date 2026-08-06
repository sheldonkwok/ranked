ALTER TABLE "users" ALTER COLUMN "twitch_id" DROP NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_lower_unique" ON "users" USING btree (lower("username"));--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_identity_required" CHECK ("users"."twitch_id" IS NOT NULL OR "users"."steam_id" IS NOT NULL);