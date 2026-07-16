import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

declare global {
  // eslint-disable-next-line no-var
  var __glimpseTursoClient: ReturnType<typeof createClient> | undefined;
}

function getClient() {
  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (global.__glimpseTursoClient) return global.__glimpseTursoClient;

  if (!url) {
    // No Turso database configured — fall back to a local SQLite file so
    // `npm run dev` / `npm run build` work out of the box. Point
    // TURSO_DATABASE_URL + TURSO_AUTH_TOKEN at a real Turso database
    // (see README) before deploying.
    if (process.env.NODE_ENV !== "test") {
      console.warn(
        "[glimpse] TURSO_DATABASE_URL not set — using local file:./glimpse-local.db. " +
          "See README.md to connect a real Turso database."
      );
    }
    global.__glimpseTursoClient = createClient({ url: "file:./glimpse-local.db" });
    return global.__glimpseTursoClient;
  }

  global.__glimpseTursoClient = createClient({ url, authToken });
  return global.__glimpseTursoClient;
}

export const db = drizzle(getClient(), { schema });
