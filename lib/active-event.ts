import { desc, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { events } from "@/db/schema";

/**
 * Resolves the event ID the rest of the app should target. Prefers the
 * M1_EVENT_ID env var when set; otherwise falls back to the most recently
 * created event in `open` or `running` status.
 *
 * The fallback is what makes /api/setup useful — once setup creates the
 * event, the homepage and admin pages light up immediately, no redeploy
 * required to pin M1_EVENT_ID.
 */
export async function getActiveEventId(): Promise<string | null> {
  const fromEnv = process.env.M1_EVENT_ID;
  if (fromEnv) return fromEnv;
  const row = await db.query.events.findFirst({
    where: inArray(events.status, ["open", "running"]),
    orderBy: [desc(events.createdAt)],
  });
  return row?.id ?? null;
}
