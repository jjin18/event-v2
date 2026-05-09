import { desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { attendees, scans, sponsors } from "@/db/schema";
import { getActiveEventId } from "@/lib/active-event";

export default async function ScansPage() {
  const eventId = await getActiveEventId();
  if (!eventId) return <p className="text-muted">No active event.</p>;

  const sponsor = await db.query.sponsors.findFirst({ where: eq(sponsors.eventId, eventId) });
  if (!sponsor) return <p className="text-muted">No sponsor configured.</p>;

  const rows = await db
    .select({
      id: scans.id,
      rating: scans.rating,
      note: scans.note,
      matchStatus: scans.matchStatus,
      matchReasoning: scans.matchReasoning,
      scannedAt: scans.scannedAt,
      scannerEmail: scans.scannerEmail,
      attendeeName: attendees.name,
      attendeeSchool: attendees.school,
    })
    .from(scans)
    .innerJoin(attendees, eq(attendees.id, scans.attendeeId))
    .where(eq(scans.eventId, eventId))
    .orderBy(desc(scans.scannedAt));

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Scans</h1>
          <p className="text-sm text-muted">
            {rows.length} total · {rows.filter((r) => r.matchStatus === "match").length} verified ICP
            matches for {sponsor.companyName}.
          </p>
        </div>
        <a className="btn-secondary" href="/api/admin/export/scans">
          Export CSV
        </a>
      </header>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-card text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 text-left">Time</th>
              <th className="px-4 py-3 text-left">Attendee</th>
              <th className="px-4 py-3 text-left">Rating</th>
              <th className="px-4 py-3 text-left">Match</th>
              <th className="px-4 py-3 text-left">Note</th>
              <th className="px-4 py-3 text-left">Scanner</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-border align-top">
                <td className="px-4 py-3 font-mono text-xs">
                  {new Date(r.scannedAt).toLocaleTimeString()}
                </td>
                <td className="px-4 py-3">
                  <p>{r.attendeeName}</p>
                  <p className="text-xs text-muted">{r.attendeeSchool}</p>
                </td>
                <td className="px-4 py-3">{r.rating}</td>
                <td className="px-4 py-3">
                  <p>{r.matchStatus}</p>
                  <p className="max-w-md text-xs text-muted">{r.matchReasoning}</p>
                </td>
                <td className="px-4 py-3 text-xs">{r.note}</td>
                <td className="px-4 py-3 font-mono text-xs">{r.scannerEmail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
