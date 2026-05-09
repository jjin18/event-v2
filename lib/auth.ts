import { auth, currentUser } from "@clerk/nextjs/server";

export async function requireAdmin(): Promise<{ userId: string; email: string }> {
  const { userId } = await auth();
  if (!userId) throw new Response("Unauthorized", { status: 401 });

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email) throw new Response("Forbidden", { status: 403 });

  const adminEmails = (process.env.M1_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (!adminEmails.includes(email.toLowerCase())) {
    throw new Response("Forbidden", { status: 403 });
  }

  return { userId, email };
}

export async function requireBoothStaff(sponsorBoothEmails: string[]): Promise<{
  userId: string;
  email: string;
}> {
  const { userId } = await auth();
  if (!userId) throw new Response("Unauthorized", { status: 401 });

  const user = await currentUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  if (!email) throw new Response("Forbidden", { status: 403 });

  const allowed = sponsorBoothEmails.map((e) => e.toLowerCase());
  if (!allowed.includes(email.toLowerCase())) {
    throw new Response("Forbidden", { status: 403 });
  }

  return { userId, email };
}
