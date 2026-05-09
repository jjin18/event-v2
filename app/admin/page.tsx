import { count, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { attendees, events, scans, sponsors } from "@/db/schema";
import { CompositionRevealButton } from "./composition-reveal-button";
import { getActiveEventId } from "@/lib/active-event";

export default async function AdminOverview() {
  const eventId = await getActiveEventId();
  if (!eventId) {
    return (
      <div>
        <h1 className="text-2xl font-semibold">No active event</h1>
        <p className="mt-2 text-muted">
          Hit <code className="font-mono">POST /api/setup?token=…</code> to bootstrap the event and
          sponsor.
        </p>
      </div>
    );
  }

  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) {
    return <div className="text-danger">Event {eventId} not found in database.</div>;
  }

  const [totalApps] = await db
    .select({ value: count() })
    .from(attendees)
    .where(eq(attendees.eventId, eventId));
  const [scanCount] = await db
    .select({ value: count() })
    .from(scans)
    .where(eq(scans.eventId, eventId));
  const sponsor = await db.query.sponsors.findFirst({ where: eq(sponsors.eventId, eventId) });

  return (
    <div className="space-y-8">
      <header className="flex items-start justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-muted">{event.organizerName}</p>
          <h1 className="mt-1 text-2xl font-semibold">{event.name}</h1>
          <p className="text-sm text-muted">
            {new Date(event.date).toLocaleDateString()} · {event.location}
          </p>
        </div>
        <CompositionRevealButton />
      </header>

      <div className="grid grid-cols-3 gap-4">
        <Stat label="Applications" value={totalApps.value.toString()} />
        <Stat label="Scans recorded" value={scanCount.value.toString()} />
        <Stat label="Sponsor" value={sponsor?.companyName ?? "(none)"} />
      </div>

      {sponsor ? (
        <div className="card">
          <h2 className="text-base font-semibold">Sponsor contract</h2>
          <dl className="mt-4 grid grid-cols-3 gap-4 text-sm">
            <Field label="Base fee" value={`$${(sponsor.baseFeeCents / 100).toLocaleString()}`} />
            <Field
              label="Per-match fee"
              value={`$${(sponsor.perMatchFeeCents / 100).toLocaleString()}`}
            />
            <Field label="Cap" value={`$${(sponsor.capCents / 100).toLocaleString()}`} />
          </dl>
          <p className="mt-4 text-xs text-muted">{sponsor.icpDefinition.description}</p>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 font-mono text-sm">{value}</dd>
    </div>
  );
}
