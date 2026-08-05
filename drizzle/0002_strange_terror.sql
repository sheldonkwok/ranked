CREATE TABLE "steam_app_misses" (
	"steam_app_id" integer PRIMARY KEY NOT NULL,
	"checked_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "steam_app_id" integer;--> statement-breakpoint
CREATE INDEX "games_steam_app_id_idx" ON "games" USING btree ("steam_app_id");