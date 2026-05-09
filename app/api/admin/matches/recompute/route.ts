import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { sponsors } from "@/db/schema";
import { recomputeEventMatches } from "@/lib/matching";
import { getActiveEventId } from "@/lib/active-event";

const Body = z.object({
  sponsorId: z.string().uuid().optional(),
  force: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch (resp) {
    return resp as Response;
  }

  const eventId = await getActiveEventId();
  if (!eventId) return new NextResponse("no active event", { status: 400 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return new NextResponse("invalid request", { status: 400 });

  let sponsorId = parsed.data.sponsorId;
  if (!sponsorId) {
    const sponsor = await db.query.sponsors.findFirst({ where: eq(sponsors.eventId, eventId) });
    if (!sponsor) return new NextResponse("no sponsor for event", { status: 400 });
    sponsorId = sponsor.id;
  }

  const result = await recomputeEventMatches(sponsorId, { force: parsed.data.force });
  return NextResponse.json(result);
}
