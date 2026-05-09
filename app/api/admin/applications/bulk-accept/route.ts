import { NextResponse } from "next/server";
import { and, eq, gte } from "drizzle-orm";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { attendees, events } from "@/db/schema";
import { sendAcceptanceEmail } from "@/lib/email";

const Body = z.object({
  threshold: z.number().int().min(0).max(100).default(70),
  dryRun: z.boolean().optional(),
});

export async function POST(req: Request) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (resp) {
    return resp as Response;
  }

  const eventId = process.env.M1_EVENT_ID;
  if (!eventId) return new NextResponse("no active event", { status: 400 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return new NextResponse(parsed.error.message, { status: 400 });

  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) return new NextResponse("event not found", { status: 404 });

  const candidates = await db.query.attendees.findMany({
    where: and(
      eq(attendees.eventId, eventId),
      eq(attendees.applicationStatus, "pending"),
      gte(attendees.confidenceScore, parsed.data.threshold),
    ),
  });

  if (parsed.data.dryRun) {
    return NextResponse.json({ count: candidates.length, dryRun: true });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  let accepted = 0;
  for (const a of candidates) {
    await db
      .update(attendees)
      .set({
        applicationStatus: "accepted",
        decidedBy: admin.email,
        decidedAt: new Date(),
        decisionReason: `bulk-accept ≥${parsed.data.threshold}`,
      })
      .where(eq(attendees.id, a.id));
    try {
      await sendAcceptanceEmail(a.email, event.name, `${baseUrl}/check-in/${a.qrCode}`);
    } catch {
      // log-and-continue: email failures shouldn't roll back the decision
    }
    accepted += 1;
  }

  return NextResponse.json({ accepted });
}
