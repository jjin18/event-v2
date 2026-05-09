import { and, count, eq, isNotNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { attendees } from "@/db/schema";
import { CheckInScanner } from "./scanner";
import { WalkInForm } from "./walk-in-form";
import { getActiveEventId } from "@/lib/active-event";

export const dynamic = "force-dynamic";

export default async function CheckInPage() {
  const eventId = await getActiveEventId();
  if (!eventId) return <p className="text-muted">No active event.</p>;

  const [confirmedCount] = await db
    .select({ value: count() })
    .from(attendees)
    .where(eq(attendees.eventId, eventId));
  const [checkedInCount] = await db
    .select({ value: count() })
    .from(attendees)
    .where(and(eq(attendees.eventId, eventId), isNotNull(attendees.checkedInAt)));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Check-in</h1>
        <p className="text-sm text-muted">
          {checkedInCount.value} / {confirmedCount.value} attendees checked in
        </p>
      </header>

      <CheckInScanner />

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Walk-in registration</h2>
        <p className="text-sm text-muted">
          Capture name, email, GitHub if known. Walk-ins are flagged low-confidence in the dataset.
        </p>
        <WalkInForm />
      </section>
    </div>
  );
}
