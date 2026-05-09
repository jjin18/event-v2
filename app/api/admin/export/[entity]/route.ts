import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { attendees, scans } from "@/db/schema";
import { toCsv } from "@/lib/csv";
import { getActiveEventId } from "@/lib/active-event";

const ATTENDEE_HEADERS = [
  "id",
  "name",
  "email",
  "github_username",
  "school",
  "class_year",
  "current_role",
  "confidence_score",
  "application_status",
  "is_walk_in",
  "checked_in_at",
  "created_at",
];

const SCAN_HEADERS = [
  "id",
  "attendee_name",
  "attendee_email",
  "rating",
  "match_status",
  "match_reasoning",
  "note",
  "scanner_email",
  "scanned_at",
];

export async function GET(_req: Request, { params }: { params: Promise<{ entity: string }> }) {
  try {
    await requireAdmin();
  } catch (resp) {
    return resp as Response;
  }

  const eventId = await getActiveEventId();
  if (!eventId) return new NextResponse("no active event", { status: 400 });

  const { entity } = await params;

  if (entity === "attendees") {
    const rows = await db.query.attendees.findMany({
      where: eq(attendees.eventId, eventId),
      orderBy: [desc(attendees.confidenceScore), desc(attendees.createdAt)],
    });
    const csv = toCsv(
      rows.map((a) => ({
        id: a.id,
        name: a.name,
        email: a.email,
        github_username: a.githubUsername,
        school: a.school,
        class_year: a.classYear,
        current_role: a.currentRole,
        confidence_score: a.confidenceScore,
        application_status: a.applicationStatus,
        is_walk_in: a.isWalkIn,
        checked_in_at: a.checkedInAt,
        created_at: a.createdAt,
      })),
      ATTENDEE_HEADERS,
    );
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="attendees-${eventId}.csv"`,
      },
    });
  }

  if (entity === "scans") {
    const rows = await db
      .select({
        id: scans.id,
        rating: scans.rating,
        matchStatus: scans.matchStatus,
        matchReasoning: scans.matchReasoning,
        note: scans.note,
        scannerEmail: scans.scannerEmail,
        scannedAt: scans.scannedAt,
        attendeeName: attendees.name,
        attendeeEmail: attendees.email,
      })
      .from(scans)
      .innerJoin(attendees, eq(attendees.id, scans.attendeeId))
      .where(eq(scans.eventId, eventId));
    const csv = toCsv(
      rows.map((s) => ({
        id: s.id,
        attendee_name: s.attendeeName,
        attendee_email: s.attendeeEmail,
        rating: s.rating,
        match_status: s.matchStatus,
        match_reasoning: s.matchReasoning,
        note: s.note,
        scanner_email: s.scannerEmail,
        scanned_at: s.scannedAt,
      })),
      SCAN_HEADERS,
    );
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="scans-${eventId}.csv"`,
      },
    });
  }

  return new NextResponse("unknown entity", { status: 404 });
}
