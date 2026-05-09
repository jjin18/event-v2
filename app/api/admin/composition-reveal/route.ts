import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { attendees, events, sponsors } from "@/db/schema";
import { sendCompositionRevealEmail } from "@/lib/email";
import { getActiveEventId } from "@/lib/active-event";

export async function POST() {
  try {
    await requireAdmin();
  } catch (resp) {
    return resp as Response;
  }

  const eventId = await getActiveEventId();
  if (!eventId) return new NextResponse("no active event", { status: 400 });
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) return new NextResponse("event not found", { status: 404 });

  const confirmed = await db.query.attendees.findMany({
    where: and(
      eq(attendees.eventId, eventId),
      inArray(attendees.applicationStatus, ["accepted", "auto_approved"]),
    ),
  });

  const sponsorRows = await db.query.sponsors.findMany({ where: eq(sponsors.eventId, eventId) });
  const sponsorBlurbs = sponsorRows.map((s) => ({
    company: s.companyName,
    focus: s.icpDefinition.description || "(focus not specified)",
  }));

  const breakdown = bucketByRole(confirmed);
  const body = {
    confirmedCount: confirmed.length,
    breakdown,
    sponsorBlurbs,
  };

  let sent = 0;
  let failed = 0;
  for (const a of confirmed) {
    if (!a.email) continue;
    try {
      await sendCompositionRevealEmail(a.email, event.name, body);
      sent += 1;
    } catch {
      failed += 1;
    }
  }
  return NextResponse.json({ sent, failed, confirmed: confirmed.length });
}

function bucketByRole(rows: Array<{ currentRole: string | null; classYear: string | null }>) {
  const buckets = new Map<string, number>();
  for (const r of rows) {
    const label = inferBucket(r.currentRole, r.classYear);
    buckets.set(label, (buckets.get(label) ?? 0) + 1);
  }
  return [...buckets.entries()].map(([label, count]) => ({ label, count }));
}

function inferBucket(role: string | null, classYear: string | null): string {
  const r = (role ?? "").toLowerCase();
  const y = (classYear ?? "").toLowerCase();
  if (r.includes("founder") || r.includes("ceo")) return "founders";
  if (r.includes("research") || r.includes("phd")) return "researchers";
  if (r.includes("ml") || r.includes("ai")) return "ML / AI engineers";
  if (r.includes("data")) return "data engineers";
  if (r.includes("design") || r.includes("ux")) return "designers";
  if (r.includes("eng") || r.includes("dev")) return "engineers";
  if (y.match(/20\d{2}/) || y.includes("undergrad") || y.includes("grad")) return "students";
  return "other";
}
