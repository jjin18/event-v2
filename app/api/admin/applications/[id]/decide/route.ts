import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { attendees, events } from "@/db/schema";
import { sendAcceptanceEmail, sendRejectionEmail } from "@/lib/email";

const Body = z.object({ decision: z.enum(["accepted", "rejected"]) });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (resp) {
    return resp as Response;
  }

  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return new NextResponse("invalid request", { status: 400 });

  const attendee = await db.query.attendees.findFirst({ where: eq(attendees.id, id) });
  if (!attendee) return new NextResponse("not found", { status: 404 });

  await db
    .update(attendees)
    .set({
      applicationStatus: parsed.data.decision,
      decidedBy: admin.email,
      decidedAt: new Date(),
    })
    .where(eq(attendees.id, id));

  const event = await db.query.events.findFirst({ where: eq(events.id, attendee.eventId) });
  const eventName = event?.name ?? "the event";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  if (parsed.data.decision === "accepted") {
    await sendAcceptanceEmail(attendee.email, eventName, `${baseUrl}/check-in/${attendee.qrCode}`);
  } else {
    await sendRejectionEmail(attendee.email, eventName);
  }

  return NextResponse.json({ ok: true });
}
