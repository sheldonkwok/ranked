CREATE TABLE "game_platforms" (
	"game_id" integer NOT NULL,
	"platform_id" integer NOT NULL,
	CONSTRAINT "game_platforms_game_id_platform_id_pk" PRIMARY KEY("game_id","platform_id")
);
--> statement-breakpoint
CREATE TABLE "platforms" (
	"id" serial PRIMARY KEY NOT NULL,
	"igdb_id" integer NOT NULL,
	"name" text NOT NULL,
	"abbreviation" text,
	CONSTRAINT "platforms_igdb_id_unique" UNIQUE("igdb_id")
);
--> statement-breakpoint
ALTER TABLE "game_platforms" ADD CONSTRAINT "game_platforms_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_platforms" ADD CONSTRAINT "game_platforms_platform_id_platforms_id_fk" FOREIGN KEY ("platform_id") REFERENCES "public"."platforms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "game_platforms_platform_id_idx" ON "game_platforms" USING btree ("platform_id");