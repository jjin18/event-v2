import { and, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { attendees, outcomes, scans, sponsors } from "@/db/schema";
import { OutcomesTable } from "./table";
import { getActiveEventId } from "@/lib/active-event";

export const dynamic = "force-dynamic";

export default async function OutcomesPage() {
  const eventId = await getActiveEventId();
  if (!eventId) return <p className="text-muted">No active event.</p>;

  const sponsor = await db.query.sponsors.findFirst({ where: eq(sponsors.eventId, eventId) });
  if (!sponsor) return <p className="text-muted">No sponsor configured.</p>;

  const matched = await db
    .select({
      attendeeId: attendees.id,
      attendeeName: attendees.name,
      attendeeEmail: attendees.email,
      school: attendees.school,
      currentRole: attendees.currentRole,
      rating: scans.rating,
      scanNote: scans.note,
    })
    .from(scans)
    .innerJoin(attendees, eq(attendees.id, scans.attendeeId))
    .where(and(eq(scans.eventId, eventId), eq(scans.matchStatus, "match")));

  const existing = await db.query.outcomes.findMany({ where: eq(outcomes.sponsorId, sponsor.id) });
  const byAttendee = new Map(existing.map((o) => [o.attendeeId, o]));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Outcomes</h1>
        <p className="text-sm text-muted">
          Capture status updates as {sponsor.companyName} reports them. Reminders to AI Taco at 14, 30, 60, 90
          days are scheduled manually for now.
        </p>
      </header>

      <OutcomesTable
        rows={matched.map((m) => {
          const o = byAttendee.get(m.attendeeId);
          return {
            attendeeId: m.attendeeId,
            attendeeName: m.attendeeName || m.attendeeEmail,
            attendeeEmail: m.attendeeEmail,
            school: m.school,
            currentRole: m.currentRole,
            rating: m.rating,
            scanNote: m.scanNote,
            status: o?.status ?? "no_follow_up",
            notes: o?.notes ?? "",
            role: o?.role ?? "",
          };
        })}
      />
    </div>
  );
}
