#!/usr/bin/env node
/**
 * Seeds the M1 event + sponsor directly via Postgres.
 *
 * Usage:
 *   DATABASE_URL=<your-supabase-url> node scripts/seed-m1.mjs
 *
 * Or via Railway, against the production DB:
 *   railway run --service event-v2 node scripts/seed-m1.mjs
 *
 * The script is idempotent — re-running it returns the existing event/sponsor
 * IDs instead of creating duplicates. Edit EVENT and SPONSOR below to match
 * the actual contract terms before running.
 *
 * After running, set M1_EVENT_ID in Railway to the printed event ID and
 * redeploy.
 */
import postgres from "postgres";

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

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }

  const sql = postgres(url, { prepare: false, max: 1 });

  try {
    // Idempotency: match on (name, organizer_name, date) so re-running is safe.
    const existingEvent = await sql`
      SELECT id FROM events
      WHERE name = ${EVENT.name}
        AND organizer_name = ${EVENT.organizer_name}
        AND date = ${EVENT.date}
      LIMIT 1
    `;

    let eventId;
    if (existingEvent.length > 0) {
      eventId = existingEvent[0].id;
      console.log(`event already exists, reusing: ${eventId}`);
    } else {
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
      eventId = row.id;
      console.log(`created event: ${eventId}`);
    }

    const existingSponsor = await sql`
      SELECT id FROM sponsors
      WHERE event_id = ${eventId} AND company_name = ${SPONSOR.company_name}
      LIMIT 1
    `;

    let sponsorId;
    if (existingSponsor.length > 0) {
      sponsorId = existingSponsor[0].id;
      console.log(`sponsor already exists, reusing: ${sponsorId}`);
    } else {
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
      sponsorId = row.id;
      console.log(`created sponsor: ${sponsorId}`);
    }

    console.log("");
    console.log("Done. Set this in Railway, then redeploy:");
    console.log("");
    console.log(`  M1_EVENT_ID=${eventId}`);
    console.log("");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
