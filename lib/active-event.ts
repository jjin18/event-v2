import { desc, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { events } from "@/db/schema";

/**
 * Resolves the event ID the rest of the app should target. Prefers the
 * M1_EVENT_ID env var when set; otherwise falls back to the most recently
 * created event in `open` or `running` status.
 *
 * Returns null on any failure (DATABASE_URL unset, schema not yet applied,
 * connection refused) so callers can render their "no active event" state
 * instead of crashing. The pre-bootstrap homepage hits this path before
 * /api/setup has run.
 */
export async function getActiveEventId(): Promise<string | null> {
  const fromEnv = process.env.M1_EVENT_ID;
  if (fromEnv) return fromEnv;
  try {
    const row = await db.query.events.findFirst({
      where: inArray(events.status, ["open", "running"]),
      orderBy: [desc(events.createdAt)],
    });
    return row?.id ?? null;
  } catch (err) {
    console.warn("[active-event] failed to resolve from DB:", errorMessage(err));
    return null;
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
