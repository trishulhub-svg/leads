// src/lib/db.ts
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
// Relative path so this module works BOTH under Next/webpack (which maps @/) and
// under plain tsx/node (e.g. `npm run db:seed`), where the alias isn't configured.
import * as schema from "../../drizzle/schema";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

if (!url) {
  throw new Error(
    "TURSO_DATABASE_URL is not set. Copy .env.example to .env.local.\n" +
      "For local dev use: TURSO_DATABASE_URL=file:local.db"
  );
}

const client = createClient({ url, authToken });

export const db = drizzle(client, { schema });
/** Raw libSQL client for one-off DDL / PRAGMA (schema ensures). */
export const clientSql = client;
export { schema };
