import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { attendees, scans, sponsors } from "@/db/schema";
import { getOrComputeMatch } from "@/lib/matching";

const Body = z.object({
  attendeeId: z.string().uuid(),
  rating: z.enum(["strong_fit", "some_interest", "not_a_match"]),
  note: z.string().max(100).default(""),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("unauthorized", { status: 401 });

  const eventId = process.env.M1_EVENT_ID;
  if (!eventId) return new NextResponse("no active event", { status: 400 });

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase();
  if (!email) return new NextResponse("forbidden", { status: 403 });

  const sponsor = await db.query.sponsors.findFirst({ where: eq(sponsors.eventId, eventId) });
  if (!sponsor) return new NextResponse("no sponsor for event", { status: 400 });
  if (!sponsor.boothStaffEmails.map((e) => e.toLowerCase()).includes(email)) {
    return new NextResponse("forbidden", { status: 403 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return new NextResponse(parsed.error.message, { status: 400 });

  const attendee = await db.query.attendees.findFirst({
    where: and(eq(attendees.eventId, eventId), eq(attendees.id, parsed.data.attendeeId)),
  });
  if (!attendee) return new NextResponse("attendee not found", { status: 404 });

  let match;
  try {
    match = await getOrComputeMatch(sponsor.id, sponsor.eventId, attendee, sponsor.icpDefinition);
  } catch (err) {
    match = {
      status: "needs_review" as const,
      reasoning: err instanceof Error ? err.message : "match evaluation failed",
      matchedCriteria: [],
      missingCriteria: [],
    };
  }

  await db
    .insert(scans)
    .values({
      eventId,
      sponsorId: sponsor.id,
      attendeeId: attendee.id,
      scannerEmail: email,
      rating: parsed.data.rating,
      note: parsed.data.note,
      matchStatus: match.status,
      matchReasoning: match.reasoning,
    })
    .onConflictDoUpdate({
      target: [scans.sponsorId, scans.attendeeId],
      set: {
        scannerEmail: email,
        rating: parsed.data.rating,
        note: parsed.data.note,
        matchStatus: match.status,
        matchReasoning: match.reasoning,
        scannedAt: new Date(),
      },
    });

  return NextResponse.json({ ok: true, matchStatus: match.status });
}
