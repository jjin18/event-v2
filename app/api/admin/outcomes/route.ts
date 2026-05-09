import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { outcomes, sponsors } from "@/db/schema";

const Body = z.object({
  attendeeId: z.string().uuid(),
  status: z.enum(["no_follow_up", "contacted", "interviewing", "offered", "hired", "declined"]),
  notes: z.string().max(2000).optional(),
  role: z.string().max(255).optional(),
});

export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch (resp) {
    return resp as Response;
  }

  const eventId = process.env.M1_EVENT_ID;
  if (!eventId) return new NextResponse("no active event", { status: 400 });

  const sponsor = await db.query.sponsors.findFirst({ where: eq(sponsors.eventId, eventId) });
  if (!sponsor) return new NextResponse("no sponsor for event", { status: 400 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return new NextResponse(parsed.error.message, { status: 400 });

  await db
    .insert(outcomes)
    .values({
      eventId,
      sponsorId: sponsor.id,
      attendeeId: parsed.data.attendeeId,
      status: parsed.data.status,
      notes: parsed.data.notes ?? "",
      role: parsed.data.role ?? null,
    })
    .onConflictDoUpdate({
      target: [outcomes.sponsorId, outcomes.attendeeId],
      set: {
        status: parsed.data.status,
        notes: parsed.data.notes ?? "",
        role: parsed.data.role ?? null,
        capturedAt: new Date(),
      },
    });

  return NextResponse.json({ ok: true });
}
