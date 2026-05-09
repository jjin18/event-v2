#!/usr/bin/env node
/**
 * Bootstraps the M1 database: runs migrations idempotently, then seeds the
 * event + sponsor.
 *
 * Usage:
 *   DATABASE_URL=<your-supabase-url> node scripts/seed-m1.mjs
 *
 * Or via Railway, against the production DB:
 *   railway run --service event-v2 node scripts/seed-m1.mjs
 *
 * Idempotent end-to-end: re-running checks for existing tables/types/rows and
 * skips work that's already done. Edit EVENT and SPONSOR below to match the
 * actual contract terms before running. After it prints M1_EVENT_ID, set that
 * in Railway and redeploy.
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..");

const EVENT = {
  name: "Founders Inc / MakerMods Hackathon",
  organizer_name: "Founders Inc",
  date: "2026-06-14T17:00:00Z",
  location: "San Francisco, CA",
  description: "Weekend hackathon. Verified builders only.",
  expected_attendance: 60,
  status: "open",
};

const SPONSOR = {
  company_name: "AI Taco",
  contact_email: "founder@aitaco.example",
  base_fee_cents: 500_000, // $5,000 base
  per_match_fee_cents: 50_000, // $500 per verified ICP match
  cap_cents: 1_500_000, // $15,000 cap
  booth_staff_emails: ["recruiter@aitaco.example"],
  icp_definition: {
    description:
      "Senior engineers building AI infra; would consider joining an early-stage AI infra company.",
    targetRoles: ["ML engineer", "infrastructure engineer", "platform engineer"],
    seniorityBands: ["senior", "staff"],
    requiredSkills: ["distributed systems", "GPU/CUDA or inference"],
    niceToHaveSkills: ["Rust", "Triton", "vLLM", "Ray"],
    institutions: [],
    institutionTier: "any",
    behavioralCriteria:
      "Has shipped a substantial AI infra project publicly (paper, blog, OSS).",
  },
};

const REQUIRED_TABLES = [
  "events",
  "attendees",
  "email_verifications",
  "sponsors",
  "scans",
  "outcomes",
  "attendee_matches",
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set.");
    console.error("");
    console.error("Get the connection string from Supabase → Project Settings → Database.");
    console.error('Then run: DATABASE_URL="<url>" npm run db:seed-m1');
    process.exit(1);
  }

  // Supabase pooler URLs typically need SSL. postgres-js auto-detects from
  // sslmode=require, but be permissive in case the URL omits it.
  const sql = postgres(url, {
    prepare: false,
    max: 1,
    ssl: url.includes("sslmode=") ? undefined : "require",
  });

  try {
    await applyMigrations(sql);
    const eventId = await upsertEvent(sql);
    await upsertSponsor(sql, eventId);
    console.log("");
    console.log("Done. Set this in Railway, then redeploy:");
    console.log("");
    console.log(`  M1_EVENT_ID=${eventId}`);
    console.log("");
  } finally {
    await sql.end();
  }
}

async function applyMigrations(sql) {
  const present = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = ANY(current_schemas(false))
      AND table_name = ANY(${REQUIRED_TABLES})
  `;
  const have = new Set(present.map((r) => r.table_name));
  const missing = REQUIRED_TABLES.filter((t) => !have.has(t));
  if (missing.length === 0) {
    console.log("schema already applied, skipping migrations");
    return;
  }
  console.log(`schema missing tables: ${missing.join(", ")}`);

  if (!have.has("events")) {
    await runMigration(sql, "0001_initial.sql");
  }
  if (!have.has("attendee_matches")) {
    await runMigration(sql, "0002_attendee_matches.sql");
  }
}

async function runMigration(sql, file) {
  const path = join(REPO_ROOT, "db", "migrations", file);
  const body = await readFile(path, "utf8");
  console.log(`applying ${file}...`);
  await sql.unsafe(body);
}

async function upsertEvent(sql) {
  const existing = await sql`
    SELECT id FROM events
    WHERE name = ${EVENT.name}
      AND organizer_name = ${EVENT.organizer_name}
      AND date = ${EVENT.date}
    LIMIT 1
  `;
  if (existing.length > 0) {
    const id = existing[0].id;
    console.log(`event already exists, reusing: ${id}`);
    return id;
  }
  const [row] = await sql`
    INSERT INTO events (name, organizer_name, date, location, description, expected_attendance, status)
    VALUES (
      ${EVENT.name},
      ${EVENT.organizer_name},
      ${EVENT.date},
      ${EVENT.location},
      ${EVENT.description},
      ${EVENT.expected_attendance},
      ${EVENT.status}
    )
    RETURNING id
  `;
  console.log(`created event: ${row.id}`);
  return row.id;
}

async function upsertSponsor(sql, eventId) {
  const existing = await sql`
    SELECT id FROM sponsors
    WHERE event_id = ${eventId} AND company_name = ${SPONSOR.company_name}
    LIMIT 1
  `;
  if (existing.length > 0) {
    console.log(`sponsor already exists, reusing: ${existing[0].id}`);
    return existing[0].id;
  }
  const [row] = await sql`
    INSERT INTO sponsors (
      event_id, company_name, contact_email, base_fee_cents,
      per_match_fee_cents, cap_cents, icp_definition, booth_staff_emails
    )
    VALUES (
      ${eventId},
      ${SPONSOR.company_name},
      ${SPONSOR.contact_email},
      ${SPONSOR.base_fee_cents},
      ${SPONSOR.per_match_fee_cents},
      ${SPONSOR.cap_cents},
      ${sql.json(SPONSOR.icp_definition)},
      ${sql.json(SPONSOR.booth_staff_emails)}
    )
    RETURNING id
  `;
  console.log(`created sponsor: ${row.id}`);
  return row.id;
}

main().catch((err) => {
  console.error("");
  console.error("seed-m1 failed:", err.message ?? err);
  if (err.code) console.error(`  (postgres error code: ${err.code})`);
  if (err.code === "42P01") {
    console.error("  → table not found. Migration apply may have failed silently.");
  } else if (err.code === "42703") {
    console.error("  → column not found. Schema may be ahead of this branch.");
  } else if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") {
    console.error("  → check DATABASE_URL host/port and that your IP is allowed.");
  }
  process.exit(1);
});
