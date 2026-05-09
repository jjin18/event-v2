import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { attendeeMatches, attendees, sponsors } from "@/db/schema";
import { RecomputeButton } from "./recompute-button";

export default async function MatchesPage() {
  const eventId = process.env.M1_EVENT_ID;
  if (!eventId) return <p className="text-muted">No active event.</p>;

  const sponsor = await db.query.sponsors.findFirst({ where: eq(sponsors.eventId, eventId) });
  if (!sponsor) return <p className="text-muted">No sponsor configured.</p>;

  const confirmed = await db.query.attendees.findMany({
    where: and(
      eq(attendees.eventId, eventId),
      inArray(attendees.applicationStatus, ["accepted", "auto_approved"]),
    ),
  });

  const cached = await db.query.attendeeMatches.findMany({
    where: eq(attendeeMatches.sponsorId, sponsor.id),
  });
  const byAttendee = new Map(cached.map((m) => [m.attendeeId, m]));

  const counts = {
    match: cached.filter((m) => m.status === "match").length,
    partial: cached.filter((m) => m.status === "partial").length,
    no_match: cached.filter((m) => m.status === "no_match").length,
    needs_review: cached.filter((m) => m.status === "needs_review").length,
    pending: confirmed.length - cached.length,
  };

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Pre-event ICP matches</h1>
          <p className="text-sm text-muted">
            For {sponsor.companyName} · {confirmed.length} confirmed attendees
          </p>
        </div>
        <RecomputeButton />
      </header>

      <div className="grid grid-cols-5 gap-3">
        <Stat label="Match" value={counts.match} tone="success" />
        <Stat label="Partial" value={counts.partial} tone="warning" />
        <Stat label="No match" value={counts.no_match} tone="muted" />
        <Stat label="Needs review" value={counts.needs_review} tone="muted" />
        <Stat label="Not yet computed" value={counts.pending} tone="muted" />
      </div>

      <div className="overflow-hidden rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-card text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 text-left">Attendee</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Reasoning</th>
            </tr>
          </thead>
          <tbody>
            {confirmed.map((a) => {
              const m = byAttendee.get(a.id);
              return (
                <tr key={a.id} className="border-t border-border align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium">{a.name || a.email}</p>
                    <p className="text-xs text-muted">
                      {[a.school, a.classYear, a.currentRole].filter(Boolean).join(" · ")}
                    </p>
                  </td>
                  <td className="px-4 py-3">{m ? m.status : <span className="text-muted">—</span>}</td>
                  <td className="px-4 py-3 max-w-xl text-xs text-muted">
                    {m?.reasoning ?? "Run recompute to evaluate."}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "warning" | "muted";
}) {
  const color = {
    success: "text-success",
    warning: "text-warning",
    muted: "text-fg",
  }[tone];
  return (
    <div className="card">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-2 text-2xl font-semibold ${color}`}>{value}</p>
    </div>
  );
}
