import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";

import type { DB } from "./prisma/types";

export { jsonArrayFrom, jsonObjectFrom } from "kysely/helpers/postgres";
export { sql } from "kysely";

export * from "./prisma/types";
export * from "./prisma/enums";

// Lazy-init the Kysely client so importing this package doesn't crash at
// module-eval time when POSTGRES_URL is missing (dev without a DB). The error
// still surfaces on the first query — which is what we want.
let _db: Kysely<DB> | undefined;
function getDb(): Kysely<DB> {
  if (!_db) {
    const connectionString = process.env.POSTGRES_URL;
    if (!connectionString) {
      throw new Error(
        "POSTGRES_URL is not set. Add it to .env.local (Supabase Session pooler, port 5432).",
      );
    }
    const pool = new Pool({ connectionString });
    _db = new Kysely<DB>({ dialect: new PostgresDialect({ pool }) });
  }
  return _db;
}

export const db = new Proxy({} as Kysely<DB>, {
  get(_target, prop) {
    const target = getDb();
    const value = Reflect.get(target, prop);
    // Bind methods so that private fields (Kysely uses #props) resolve against
    // the real instance instead of the Proxy.
    return typeof value === "function" ? value.bind(target) : value;
  },
});
