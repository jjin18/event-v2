import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { attendees } from "@/db/schema";

const Body = z.object({ qrCode: z.string().min(8).max(64) });

export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch (resp) {
    return resp as Response;
  }

  const eventId = process.env.M1_EVENT_ID;
  if (!eventId) return new NextResponse("no active event", { status: 400 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return new NextResponse("invalid request", { status: 400 });

  const attendee = await db.query.attendees.findFirst({
    where: and(eq(attendees.eventId, eventId), eq(attendees.qrCode, parsed.data.qrCode)),
  });
  if (!attendee) return new NextResponse("attendee not found", { status: 404 });

  const alreadyCheckedIn = !!attendee.checkedInAt;
  if (!alreadyCheckedIn) {
    await db
      .update(attendees)
      .set({ checkedInAt: new Date() })
      .where(eq(attendees.id, attendee.id));
  }

  return NextResponse.json({
    attendeeId: attendee.id,
    name: attendee.name,
    email: attendee.email,
    school: attendee.school,
    classYear: attendee.classYear,
    alreadyCheckedIn,
  });
}
