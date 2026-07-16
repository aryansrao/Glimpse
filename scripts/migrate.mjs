import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

const url = process.env.TURSO_DATABASE_URL;

if (!url) {
  console.log("migrate: TURSO_DATABASE_URL not set, skipping (local file fallback)");
  process.exit(0);
}

const client = createClient({
  url,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
console.log("migrate: schema is up to date");
client.close();
