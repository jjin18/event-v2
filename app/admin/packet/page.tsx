import { and, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { attendees, scans, sponsors } from "@/db/schema";
import { getActiveEventId } from "@/lib/active-event";

export default async function PacketPage() {
  const eventId = await getActiveEventId();
  if (!eventId) return <p className="text-muted">No active event.</p>;

  const sponsor = await db.query.sponsors.findFirst({ where: eq(sponsors.eventId, eventId) });
  if (!sponsor) return <p className="text-muted">No sponsor configured.</p>;

  const verified = await db
    .select({
      id: scans.id,
      rating: scans.rating,
      note: scans.note,
      matchReasoning: scans.matchReasoning,
      scannedAt: scans.scannedAt,
      attendeeName: attendees.name,
      attendeeEmail: attendees.email,
      school: attendees.school,
      classYear: attendees.classYear,
      currentRole: attendees.currentRole,
      githubUsername: attendees.githubUsername,
      claimsText: attendees.claimsText,
    })
    .from(scans)
    .innerJoin(attendees, eq(attendees.id, scans.attendeeId))
    .where(and(eq(scans.eventId, eventId), eq(scans.matchStatus, "match")))
    .orderBy(desc(scans.rating));

  const matchCount = verified.length;
  const accruedCents = Math.min(
    sponsor.capCents,
    sponsor.baseFeeCents + matchCount * sponsor.perMatchFeeCents,
  );

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Post-event packet</h1>
        <p className="text-sm text-muted">
          For {sponsor.companyName} · contact {sponsor.contactEmail}
        </p>
      </header>

      <div className="card">
        <h2 className="text-base font-semibold">Contract execution</h2>
        <dl className="mt-4 grid grid-cols-4 gap-4 text-sm">
          <Stat label="Verified matches" value={matchCount.toString()} />
          <Stat label="Base fee" value={`$${(sponsor.baseFeeCents / 100).toLocaleString()}`} />
          <Stat
            label="Per-match fee"
            value={`$${(sponsor.perMatchFeeCents / 100).toLocaleString()}`}
          />
          <Stat label="Total invoice" value={`$${(accruedCents / 100).toLocaleString()}`} />
        </dl>
        <p className="mt-3 text-xs text-muted">
          Capped at ${(sponsor.capCents / 100).toLocaleString()}.
        </p>
      </div>

      <div className="space-y-4">
        <h2 className="text-base font-semibold">Verified ICP matches ({matchCount})</h2>
        {verified.length === 0 ? (
          <p className="text-sm text-muted">No verified matches yet.</p>
        ) : null}
        {verified.map((m) => (
          <div key={m.id} className="card">
            <div className="flex items-baseline justify-between">
              <p className="text-base font-semibold">{m.attendeeName}</p>
              <p className="text-xs uppercase tracking-wide text-muted">{m.rating}</p>
            </div>
            <p className="text-sm text-muted">
              {[m.school, m.classYear, m.currentRole].filter(Boolean).join(" · ")}
              {m.githubUsername ? ` · github.com/${m.githubUsername}` : ""}
            </p>
            <p className="mt-3 text-sm">{m.matchReasoning}</p>
            {m.note ? <p className="mt-2 text-xs text-muted">Booth note: {m.note}</p> : null}
            {m.claimsText ? (
              <p className="mt-2 text-xs text-muted">Self-described: {m.claimsText}</p>
            ) : null}
            <p className="mt-2 font-mono text-xs text-muted">
              {m.attendeeEmail} · {new Date(m.scannedAt).toLocaleString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold">{value}</dd>
    </div>
  );
}
