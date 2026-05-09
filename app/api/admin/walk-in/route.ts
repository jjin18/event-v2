import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { attendees, events } from "@/db/schema";
import { generateQrCode } from "@/lib/qr";
import { getActiveEventId } from "@/lib/active-event";

const Body = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(255),
  githubUsername: z.string().max(64).optional(),
  school: z.string().max(255).optional(),
  classYear: z.string().max(64).optional(),
  currentRole: z.string().max(255).optional(),
  claimsText: z.string().max(2000).optional(),
});

export async function POST(req: Request) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (resp) {
    return resp as Response;
  }

  const eventId = await getActiveEventId();
  if (!eventId) return new NextResponse("no active event", { status: 400 });
  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) return new NextResponse("event not found", { status: 404 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return new NextResponse(parsed.error.message, { status: 400 });

  const qrCode = generateQrCode();
  const [row] = await db
    .insert(attendees)
    .values({
      eventId: event.id,
      email: parsed.data.email.toLowerCase(),
      name: parsed.data.name,
      githubUsername: parsed.data.githubUsername ?? null,
      school: parsed.data.school ?? null,
      classYear: parsed.data.classYear ?? null,
      currentRole: parsed.data.currentRole ?? null,
      claimsText: parsed.data.claimsText ?? "",
      confidenceScore: 10,
      applicationStatus: "accepted",
      decidedBy: admin.email,
      decidedAt: new Date(),
      decisionReason: "walk-in",
      qrCode,
      isWalkIn: true,
      checkedInAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [attendees.eventId, attendees.email],
      set: {
        name: parsed.data.name,
        applicationStatus: "accepted",
        isWalkIn: true,
        checkedInAt: new Date(),
        decidedBy: admin.email,
        decidedAt: new Date(),
        decisionReason: "walk-in",
      },
    })
    .returning();

  return NextResponse.json({
    id: row.id,
    qrCode: row.qrCode,
    checkInUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/check-in/${row.qrCode}`,
  });
}
