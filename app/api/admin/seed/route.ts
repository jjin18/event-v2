/**
 * One-shot seed for the M1 launch event (Founders Inc / MakerMods + AI Taco).
 *
 * Hits this once after configuring DATABASE_URL and admin emails. Returns the
 * generated event_id and sponsor_id so they can be pasted into M1_EVENT_ID and
 * the AI Taco onboarding email.
 */

import { NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { events, sponsors } from "@/db/schema";
import type { IcpDefinition } from "@/db/schema";
import { validateIcp } from "@/lib/matching";

const Body = z.object({
  event: z.object({
    name: z.string(),
    organizerName: z.string(),
    date: z.string(),
    location: z.string(),
    description: z.string(),
    expectedAttendance: z.number().int().nonnegative(),
  }),
  sponsor: z.object({
    companyName: z.string(),
    contactEmail: z.string().email(),
    baseFeeCents: z.number().int().nonnegative(),
    perMatchFeeCents: z.number().int().nonnegative(),
    capCents: z.number().int().nonnegative(),
    boothStaffEmails: z.array(z.string().email()),
    icpDefinition: z.object({
      description: z.string(),
      targetRoles: z.array(z.string()),
      seniorityBands: z.array(z.string()),
      requiredSkills: z.array(z.string()),
      niceToHaveSkills: z.array(z.string()),
      institutions: z.array(z.string()),
      institutionTier: z.string().optional(),
      behavioralCriteria: z.string(),
    }),
  }),
});

export async function POST(req: Request) {
  try {
    await requireAdmin();
  } catch (resp) {
    return resp as Response;
  }

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return new NextResponse(parsed.error.message, { status: 400 });

  const icp: IcpDefinition = parsed.data.sponsor.icpDefinition;
  try {
    validateIcp(icp);
  } catch (err) {
    return new NextResponse(err instanceof Error ? err.message : "invalid ICP", { status: 400 });
  }

  const [event] = await db
    .insert(events)
    .values({
      name: parsed.data.event.name,
      organizerName: parsed.data.event.organizerName,
      date: new Date(parsed.data.event.date),
      location: parsed.data.event.location,
      description: parsed.data.event.description,
      expectedAttendance: parsed.data.event.expectedAttendance,
      status: "open",
    })
    .returning();

  const [sponsor] = await db
    .insert(sponsors)
    .values({
      eventId: event.id,
      companyName: parsed.data.sponsor.companyName,
      contactEmail: parsed.data.sponsor.contactEmail,
      baseFeeCents: parsed.data.sponsor.baseFeeCents,
      perMatchFeeCents: parsed.data.sponsor.perMatchFeeCents,
      capCents: parsed.data.sponsor.capCents,
      icpDefinition: icp,
      boothStaffEmails: parsed.data.sponsor.boothStaffEmails,
    })
    .returning();

  return NextResponse.json({ event, sponsor });
}
