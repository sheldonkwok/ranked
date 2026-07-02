CREATE TYPE "public"."tier" AS ENUM('liked', 'fine', 'disliked');--> statement-breakpoint
CREATE TABLE "entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"game_id" integer NOT NULL,
	"tier" "tier" NOT NULL,
	"position" integer NOT NULL,
	"score" numeric(3, 1) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" serial PRIMARY KEY NOT NULL,
	"igdb_id" integer NOT NULL,
	"name" text NOT NULL,
	"cover_image_id" text,
	"first_release_date" timestamp,
	"platforms" jsonb,
	"summary" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "games_igdb_id_unique" UNIQUE("igdb_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"twitch_id" text NOT NULL,
	"username" text NOT NULL,
	"display_name" text,
	"avatar_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_twitch_id_unique" UNIQUE("twitch_id")
);
--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "entries_user_game_unique" ON "entries" USING btree ("user_id","game_id");--> statement-breakpoint
CREATE INDEX "entries_user_tier_position_idx" ON "entries" USING btree ("user_id","tier","position");