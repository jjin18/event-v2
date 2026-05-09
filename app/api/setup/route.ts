import { NextResponse } from "next/server";
import { and, desc, eq, inArray } from "drizzle-orm";

import { db, pgClient } from "@/lib/db";
import { events, sponsors } from "@/db/schema";
import type { IcpDefinition } from "@/db/schema";
import { applyMissingMigrations } from "@/lib/migrations";

/**
 * One-shot bootstrap endpoint. Runs the migrations and seeds the M1 event +
 * AI Taco contingent-sponsor record from inside the deployed container, so
 * the operator never has to ssh anywhere or fight with PowerShell quoting.
 *
 * Protected by SETUP_TOKEN (env var) — pass it as either a Bearer token or a
 * `?token=` query param. Refuses to run if SETUP_TOKEN isn't configured at
 * all, so a forgotten env var doesn't leave the route exposed.
 *
 * Idempotent: re-running checks for existing schema and rows and skips any
 * work that's already done.
 *
 *   curl -X POST 'https://your-app/api/setup?token=YOUR_TOKEN'
 *
 * After this returns, the homepage and admin pages discover the event from
 * the database via getActiveEventId(), so no M1_EVENT_ID redeploy is needed.
 */

const DEFAULT_EVENT = {
  name: "Founders Inc / MakerMods Hackathon",
  organizerName: "Founders Inc",
  date: new Date("2026-06-14T17:00:00Z"),
  location: "San Francisco, CA",
  description: "Weekend hackathon. Verified builders only.",
  expectedAttendance: 60,
  status: "open" as const,
};

const DEFAULT_SPONSOR = {
  companyName: "AI Taco",
  contactEmail: "founder@aitaco.example",
  baseFeeCents: 500_000,
  perMatchFeeCents: 50_000,
  capCents: 1_500_000,
  boothStaffEmails: ["recruiter@aitaco.example"],
  icpDefinition: {
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
  } satisfies IcpDefinition,
};

type Body = {
  event?: Partial<typeof DEFAULT_EVENT> & { date?: string | Date };
  sponsor?: Partial<typeof DEFAULT_SPONSOR>;
};

export async function POST(req: Request) {
  const expected = process.env.SETUP_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { error: "SETUP_TOKEN env var is not configured; refusing to run." },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const headerToken = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const queryToken = url.searchParams.get("token") ?? "";
  if (headerToken !== expected && queryToken !== expected) {
    return NextResponse.json({ error: "invalid token" }, { status: 401 });
  }

  // Optional body lets you override the defaults at call time. Schema is
  // permissive — caller is the operator, not an end user.
  const body = (await req.json().catch(() => ({}))) as Body;
  const eventOverrides = body.event ?? {};
  const sponsorOverrides = body.sponsor ?? {};

  const applied = await applyMissingMigrations(pgClient());

  const eventInput = { ...DEFAULT_EVENT, ...eventOverrides } as typeof DEFAULT_EVENT;
  if (typeof eventInput.date === "string") {
    eventInput.date = new Date(eventInput.date);
  }

  const existingEvent = await db.query.events.findFirst({
    where: and(
      eq(events.name, eventInput.name),
      eq(events.organizerName, eventInput.organizerName),
      eq(events.date, eventInput.date),
    ),
  });
  let eventId: string;
  let createdEvent = false;
  if (existingEvent) {
    eventId = existingEvent.id;
  } else {
    const [row] = await db.insert(events).values(eventInput).returning();
    eventId = row.id;
    createdEvent = true;
  }

  const sponsorInput = { ...DEFAULT_SPONSOR, ...sponsorOverrides } as typeof DEFAULT_SPONSOR;
  const existingSponsor = await db.query.sponsors.findFirst({
    where: and(eq(sponsors.eventId, eventId), eq(sponsors.companyName, sponsorInput.companyName)),
    orderBy: [desc(sponsors.createdAt)],
  });
  let sponsorId: string;
  let createdSponsor = false;
  if (existingSponsor) {
    sponsorId = existingSponsor.id;
  } else {
    const [row] = await db
      .insert(sponsors)
      .values({
        eventId,
        companyName: sponsorInput.companyName,
        contactEmail: sponsorInput.contactEmail,
        baseFeeCents: sponsorInput.baseFeeCents,
        perMatchFeeCents: sponsorInput.perMatchFeeCents,
        capCents: sponsorInput.capCents,
        boothStaffEmails: sponsorInput.boothStaffEmails,
        icpDefinition: sponsorInput.icpDefinition,
      })
      .returning();
    sponsorId = row.id;
    createdSponsor = true;
  }

  // Reachable-event sanity check that mirrors getActiveEventId so the operator
  // can verify the homepage will pick up the new row without setting M1_EVENT_ID.
  const reachable = await db.query.events.findFirst({
    where: inArray(events.status, ["open", "running"]),
    orderBy: [desc(events.createdAt)],
  });

  return NextResponse.json({
    migrationsApplied: applied,
    event: { id: eventId, created: createdEvent, name: eventInput.name },
    sponsor: { id: sponsorId, created: createdSponsor, name: sponsorInput.companyName },
    activeEventDiscoverable: !!reachable && reachable.id === eventId,
    note: "Homepage discovers this automatically. No M1_EVENT_ID required.",
  });
}
