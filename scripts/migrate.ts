import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main() {
  const databaseUrl = process.env.POSTGRES_URL_NON_POOLING ?? process.env.POSTGRES_URL;

  if (!databaseUrl) {
    throw new Error("POSTGRES_URL_NON_POOLING or POSTGRES_URL is required to run production migrations");
  }

  const client = postgres(databaseUrl, { max: 1, prepare: false });
  const db = drizzle(client);

  console.log("Running migrations...");
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations complete.");

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
