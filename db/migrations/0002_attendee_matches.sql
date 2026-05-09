-- Pre-event ICP match cache (M1 plan, Week 4: "Cache matches in the database").
-- One row per (sponsor, attendee). Recomputed when ICP changes.

CREATE TABLE "attendee_matches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "event_id" uuid NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
  "sponsor_id" uuid NOT NULL REFERENCES "sponsors"("id") ON DELETE CASCADE,
  "attendee_id" uuid NOT NULL REFERENCES "attendees"("id") ON DELETE CASCADE,
  "status" match_status NOT NULL,
  "reasoning" text NOT NULL DEFAULT '',
  "matched_criteria" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "missing_criteria" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "computed_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "attendee_matches_sponsor_attendee_idx" ON "attendee_matches" ("sponsor_id", "attendee_id");
CREATE INDEX "attendee_matches_event_status_idx" ON "attendee_matches" ("event_id", "status");
