import { NextResponse } from "next/server";
import { z } from "zod";
import { randomInt } from "node:crypto";

import { db } from "@/lib/db";
import { emailVerifications } from "@/db/schema";
import { sendVerificationCodeEmail } from "@/lib/email";

const Body = z.object({ email: z.string().email() });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return new NextResponse("invalid email", { status: 400 });
  }
  const email = parsed.data.email.toLowerCase();
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await db.insert(emailVerifications).values({ email, code, expiresAt });
  await sendVerificationCodeEmail(email, code);

  return NextResponse.json({ ok: true });
}
