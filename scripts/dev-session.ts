// Dev helper: ensures a dev user + session exist and prints a `session=...`
// cookie string for curl testing, e.g.:
//
//   npx tsx scripts/dev-session.ts
//   curl -sI http://localhost:3000/ -H "Cookie: $(npx tsx scripts/dev-session.ts)"
//
// Intentionally loads no env vars (no dotenv, POSTGRES_URL untouched) so it
// always uses the local PGlite dev DB. PGlite only supports a single
// process per data directory, so run this with the Next dev server
// STOPPED, then start `npm run dev` again afterwards.
import { getDb, users } from "../src/db";
import { createSession } from "../src/lib/session";

async function main() {
  const db = await getDb();

  const [user] = await db
    .insert(users)
    .values({
      twitchId: "dev-user",
      username: "dev",
      displayName: "Dev User",
      avatarUrl: null,
    })
    .onConflictDoUpdate({
      target: users.twitchId,
      set: { username: "dev" },
    })
    .returning();

  const { token } = await createSession(user.id);

  console.log(`session=${token}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
