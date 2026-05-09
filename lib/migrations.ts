import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type postgres from "postgres";

type SqlClient = ReturnType<typeof postgres>;

const REQUIRED_TABLES = [
  "events",
  "attendees",
  "email_verifications",
  "sponsors",
  "scans",
  "outcomes",
  "attendee_matches",
];

/**
 * Applies any missing migrations against the live database. Idempotent: looks
 * at information_schema for the canonical table names and only runs the SQL
 * file that introduces a missing table. Returns the names of files that were
 * applied this call.
 */
export async function applyMissingMigrations(sql: SqlClient): Promise<string[]> {
  const present = await sql<{ table_name: string }[]>`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = ANY(current_schemas(false))
      AND table_name = ANY(${REQUIRED_TABLES})
  `;
  const have = new Set(present.map((r) => r.table_name));

  const applied: string[] = [];
  if (!have.has("events")) {
    await sql.unsafe(await loadMigration("0001_initial.sql"));
    applied.push("0001_initial.sql");
  }
  if (!have.has("attendee_matches")) {
    await sql.unsafe(await loadMigration("0002_attendee_matches.sql"));
    applied.push("0002_attendee_matches.sql");
  }
  return applied;
}

async function loadMigration(file: string): Promise<string> {
  return readFile(join(process.cwd(), "db", "migrations", file), "utf8");
}
