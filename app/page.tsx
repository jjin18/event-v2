import Link from "next/link";

import { db } from "@/lib/db";
import { attendees, events } from "@/db/schema";
import { eq, and, inArray } from "drizzle-orm";

async function getActiveEvent() {
  const eventId = process.env.M1_EVENT_ID;
  if (!eventId) return null;
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) return null;

  const confirmed = await db
    .select({ count: attendees.id })
    .from(attendees)
    .where(
      and(
        eq(attendees.eventId, event.id),
        inArray(attendees.applicationStatus, ["accepted", "auto_approved"]),
      ),
    );

  return { event, confirmedCount: confirmed.length };
}

export default async function Home() {
  const data = await getActiveEvent();

  if (!data) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-24">
        <h1 className="text-3xl font-semibold">No active event</h1>
        <p className="mt-4 text-muted">
          M1_EVENT_ID is not set. Configure an event in the admin to launch the public RSVP page.
        </p>
      </main>
    );
  }

  const { event, confirmedCount } = data;
  const dateLabel = new Date(event.date).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <main className="mx-auto max-w-2xl px-6 py-24">
      <p className="text-sm uppercase tracking-wide text-muted">{event.organizerName}</p>
      <h1 className="mt-2 text-4xl font-semibold leading-tight">{event.name}</h1>
      <p className="mt-3 text-lg text-muted">
        {dateLabel} · {event.location}
      </p>

      <div className="card mt-10 space-y-4">
        <p className="text-base text-fg">{event.description}</p>
        <p className="text-sm text-muted">
          {confirmedCount} confirmed attendees so far. Verified via GitHub and institutional email.
        </p>
      </div>

      <div className="mt-10 flex gap-3">
        <Link href="/apply" className="btn-primary">
          Apply to attend
        </Link>
        <Link href="#how-it-works" className="btn-secondary">
          How it works
        </Link>
      </div>

      <section id="how-it-works" className="mt-20 space-y-6">
        <h2 className="text-xl font-semibold">How it works</h2>
        <div className="space-y-4 text-sm text-muted">
          <p>
            We verify every attendee against GitHub and an institutional email. The room stays
            high-signal because we don&apos;t accept applications we can&apos;t verify.
          </p>
          <p>
            Three days before the event, we&apos;ll email you the room composition so you know who
            else is coming before you commit your travel.
          </p>
          <p>
            Sponsors at this event pay only for verified ICP matches with you, not for unfiltered
            access. Your data is never sold.
          </p>
        </div>
      </section>
    </main>
  );
}
