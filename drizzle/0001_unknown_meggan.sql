ALTER TABLE "users" ADD COLUMN "steam_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "steam_persona_name" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "steam_avatar_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "steam_linked_at" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_steam_id_unique" UNIQUE("steam_id");