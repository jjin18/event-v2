import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { attendees } from "@/db/schema";

export default async function CheckInPage({ params }: { params: Promise<{ qr: string }> }) {
  const { qr } = await params;
  const attendee = await db.query.attendees.findFirst({ where: eq(attendees.qrCode, qr) });
  if (!attendee) {
    return (
      <main className="mx-auto max-w-md px-6 py-24">
        <h1 className="text-2xl font-semibold">QR not recognized</h1>
        <p className="mt-2 text-muted">Find a registration volunteer for help.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <p className="text-xs uppercase tracking-wide text-muted">Check-in pass</p>
      <h1 className="mt-2 text-3xl font-semibold">{attendee.name || attendee.email}</h1>
      <div className="card mt-6 space-y-2">
        <p className="text-sm">{attendee.school}</p>
        <p className="text-sm text-muted">
          {[attendee.classYear, attendee.currentRole].filter(Boolean).join(" · ")}
        </p>
        <p className="font-mono text-xs text-muted">QR: {attendee.qrCode}</p>
      </div>
      <p className="mt-6 text-xs text-muted">
        Show this screen at the registration desk. Confidence score:{" "}
        {attendee.confidenceScore}/100.
      </p>
    </main>
  );
}
