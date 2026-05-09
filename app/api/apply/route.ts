import { NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { and, desc, eq, isNull, gt } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { attendees, emailVerifications, events } from "@/db/schema";
import { fetchGitHubProfile } from "@/lib/github";
import { computeConfidence } from "@/lib/confidence";
import { generateQrCode } from "@/lib/qr";
import { sendAcceptanceEmail, sendApplicationReceivedEmail } from "@/lib/email";

const Body = z.object({
  school: z.string().min(1).max(255),
  classYear: z.string().min(1).max(64),
  currentRole: z.string().min(1).max(255),
  claimsText: z.string().min(40).max(2000),
  verifyEmail: z.string().email(),
  verificationCode: z.string().regex(/^\d{6}$/),
});

const AUTO_APPROVE_THRESHOLD = 70;

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return new NextResponse("unauthorized", { status: 401 });

  const eventId = process.env.M1_EVENT_ID;
  if (!eventId) return new NextResponse("no active event configured", { status: 400 });

  const event = await db.query.events.findFirst({ where: eq(events.id, eventId) });
  if (!event) return new NextResponse("event not found", { status: 404 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return new NextResponse(parsed.error.message, { status: 400 });
  }
  const input = parsed.data;
  const verifyEmail = input.verifyEmail.toLowerCase();

  const verification = await db.query.emailVerifications.findFirst({
    where: and(
      eq(emailVerifications.email, verifyEmail),
      eq(emailVerifications.code, input.verificationCode),
      isNull(emailVerifications.consumedAt),
      gt(emailVerifications.expiresAt, new Date()),
    ),
    orderBy: desc(emailVerifications.createdAt),
  });
  if (!verification) {
    return new NextResponse("verification code invalid or expired", { status: 400 });
  }

  const user = await currentUser();
  const clerkPrimaryEmail = user?.primaryEmailAddress?.emailAddress?.toLowerCase();
  const githubAccount = user?.externalAccounts.find(
    (a) => a.provider === "github" || a.provider === "oauth_github",
  );
  const githubUsername = githubAccount?.username ?? null;

  const githubData = githubUsername ? await fetchGitHubProfile(githubUsername) : null;

  const emailDomain = verifyEmail.split("@")[1] ?? null;
  const { score } = computeConfidence({
    github: githubData,
    emailDomain,
    emailVerified: true,
    claimsText: input.claimsText,
    school: input.school,
  });

  const applicationStatus = score >= AUTO_APPROVE_THRESHOLD ? "auto_approved" : "pending";
  const qrCode = generateQrCode();

  const [inserted] = await db
    .insert(attendees)
    .values({
      eventId: event.id,
      email: clerkPrimaryEmail ?? verifyEmail,
      name:
        [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
        githubData?.name ||
        githubUsername ||
        "",
      githubUsername,
      githubData,
      emailVerified: true,
      emailVerifiedDomain: emailDomain,
      school: input.school,
      currentRole: input.currentRole,
      classYear: input.classYear,
      claimsText: input.claimsText,
      confidenceScore: score,
      applicationStatus,
      decidedBy: applicationStatus === "auto_approved" ? "system" : null,
      decidedAt: applicationStatus === "auto_approved" ? new Date() : null,
      qrCode,
      consents: { sponsor_match_sharing: true, behavioral_logging_at_event: true },
    })
    .onConflictDoUpdate({
      target: [attendees.eventId, attendees.email],
      set: {
        githubUsername,
        githubData,
        emailVerified: true,
        emailVerifiedDomain: emailDomain,
        school: input.school,
        currentRole: input.currentRole,
        classYear: input.classYear,
        claimsText: input.claimsText,
        confidenceScore: score,
      },
    })
    .returning();

  await db
    .update(emailVerifications)
    .set({ consumedAt: new Date() })
    .where(eq(emailVerifications.id, verification.id));

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  if (applicationStatus === "auto_approved" && clerkPrimaryEmail) {
    const qrUrl = `${baseUrl}/check-in/${qrCode}`;
    await sendAcceptanceEmail(clerkPrimaryEmail, event.name, qrUrl);
  } else if (clerkPrimaryEmail) {
    await sendApplicationReceivedEmail(clerkPrimaryEmail, event.name);
  }

  return NextResponse.json({
    id: inserted.id,
    applicationStatus,
    confidenceScore: score,
  });
}
