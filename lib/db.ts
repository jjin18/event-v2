import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";

// Lazy init: Next.js evaluates route modules at build time during page-data
// collection, before runtime env vars are available. Throwing at module
// import would break the build. Connection is opened on first DB use.
type Drizzle = ReturnType<typeof drizzle<typeof schema>>;
type PgClient = ReturnType<typeof postgres>;

let _pg: PgClient | null = null;
let _db: Drizzle | null = null;

function init(): { pg: PgClient; drizzle: Drizzle } {
  if (_pg && _db) return { pg: _pg, drizzle: _db };
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  _pg = postgres(connectionString, { prepare: false, max: 10 });
  _db = drizzle(_pg, { schema });
  return { pg: _pg, drizzle: _db };
}

export const db = new Proxy({} as Drizzle, {
  get(_target, prop, receiver) {
    return Reflect.get(init().drizzle, prop, receiver);
  },
}) as Drizzle;
export type DB = Drizzle;

/**
 * Underlying postgres-js client — needed for multi-statement raw SQL like
 * migrations. Use sparingly; prefer the typed drizzle `db` for queries.
 */
export function pgClient(): PgClient {
  return init().pg;
}
