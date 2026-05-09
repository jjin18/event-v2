import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { attendees, scans, sponsors } from "@/db/schema";
import { getOrComputeMatch } from "@/lib/matching";

const Body = z.object({ qrCode: z.string().min(8).max(64) });

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

  const allowedBoothEmails = sponsor.boothStaffEmails.map((e) => e.toLowerCase());
  if (!allowedBoothEmails.includes(email)) {
    return new NextResponse("forbidden", { status: 403 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return new NextResponse("invalid request", { status: 400 });

  const attendee = await db.query.attendees.findFirst({
    where: and(eq(attendees.eventId, eventId), eq(attendees.qrCode, parsed.data.qrCode)),
  });
  if (!attendee) return new NextResponse("attendee not found", { status: 404 });

  const existing = await db.query.scans.findFirst({
    where: and(eq(scans.sponsorId, sponsor.id), eq(scans.attendeeId, attendee.id)),
  });

  let matchStatus = existing?.matchStatus;
  let matchReasoning = existing?.matchReasoning ?? "";

  if (!matchStatus) {
    try {
      const result = await getOrComputeMatch(
        sponsor.id,
        sponsor.eventId,
        attendee,
        sponsor.icpDefinition,
      );
      matchStatus = result.status;
      matchReasoning = result.reasoning;
    } catch (err) {
      matchStatus = "needs_review";
      matchReasoning = err instanceof Error ? err.message : "match evaluation failed";
    }
  }

  return NextResponse.json({
    attendeeId: attendee.id,
    name: attendee.name,
    school: attendee.school,
    classYear: attendee.classYear,
    currentRole: attendee.currentRole,
    matchStatus,
    matchReasoning,
    alreadyScanned: !!existing,
  });
}
