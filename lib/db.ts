import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";

// Lazy init: Next.js evaluates route modules at build time during page-data
// collection, before runtime env vars are available. Throwing at module
// import would break the build. Connection is opened on first DB use.
type Drizzle = ReturnType<typeof drizzle<typeof schema>>;
let _db: Drizzle | null = null;

function getDb(): Drizzle {
  if (_db) return _db;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  const queryClient = postgres(connectionString, { prepare: false, max: 10 });
  _db = drizzle(queryClient, { schema });
  return _db;
}

export const db = new Proxy({} as Drizzle, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
}) as Drizzle;
export type DB = Drizzle;
