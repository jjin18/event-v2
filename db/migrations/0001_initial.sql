-- Initial M1 schema
-- Generated to mirror db/schema.ts. Run via `pnpm db:migrate` (or hand-applied to Supabase).

CREATE TYPE "event_status" AS ENUM ('draft', 'open', 'closed', 'running', 'completed', 'cancelled');
CREATE TYPE "application_status" AS ENUM ('pending', 'auto_approved', 'accepted', 'rejected', 'waitlisted');
CREATE TYPE "scan_rating" AS ENUM ('strong_fit', 'some_interest', 'not_a_match');
CREATE TYPE "match_status" AS ENUM ('match', 'partial', 'no_match', 'needs_review');
CREATE TYPE "outcome_status" AS ENUM ('no_follow_up', 'contacted', 'interviewing', 'offered', 'hired', 'declined');

CREATE TABLE "events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "organizer_name" text NOT NULL,
  "date" timestamptz NOT NULL,
  "location" text NOT NULL DEFAULT '',
  "description" text NOT NULL DEFAULT '',
  "expected_attendance" integer NOT NULL DEFAULT 0,
  "status" event_status NOT NULL DEFAULT 'draft',
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "attendees" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "event_id" uuid NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
  "email" varchar(320) NOT NULL,
  "name" text NOT NULL DEFAULT '',
  "github_username" varchar(64),
  "github_data" jsonb,
  "email_verified" boolean NOT NULL DEFAULT false,
  "email_verified_domain" varchar(255),
  "school" text,
  "current_role" text,
  "class_year" varchar(16),
  "claims_text" text NOT NULL DEFAULT '',
  "confidence_score" integer NOT NULL DEFAULT 0,
  "application_status" application_status NOT NULL DEFAULT 'pending',
  "decision_reason" text,
  "decided_by" varchar(255),
  "decided_at" timestamptz,
  "qr_code" varchar(64) NOT NULL,
  "checked_in_at" timestamptz,
  "is_walk_in" boolean NOT NULL DEFAULT false,
  "consents" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "attendees_event_email_idx" ON "attendees" ("event_id", "email");
CREATE UNIQUE INDEX "attendees_qr_code_idx" ON "attendees" ("qr_code");
CREATE INDEX "attendees_event_status_idx" ON "attendees" ("event_id", "application_status");

CREATE TABLE "email_verifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" varchar(320) NOT NULL,
  "code" varchar(12) NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "consumed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "email_verifications_email_idx" ON "email_verifications" ("email");

CREATE TABLE "sponsors" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "event_id" uuid NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
  "company_name" text NOT NULL,
  "contact_email" varchar(320) NOT NULL,
  "base_fee_cents" integer NOT NULL DEFAULT 0,
  "per_match_fee_cents" integer NOT NULL DEFAULT 0,
  "cap_cents" integer NOT NULL DEFAULT 0,
  "icp_definition" jsonb NOT NULL,
  "booth_staff_emails" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "scans" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "event_id" uuid NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
  "sponsor_id" uuid NOT NULL REFERENCES "sponsors"("id") ON DELETE CASCADE,
  "attendee_id" uuid NOT NULL REFERENCES "attendees"("id") ON DELETE CASCADE,
  "scanner_email" varchar(320) NOT NULL,
  "rating" scan_rating NOT NULL,
  "note" varchar(100) NOT NULL DEFAULT '',
  "match_status" match_status NOT NULL DEFAULT 'needs_review',
  "match_reasoning" text,
  "scanned_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "scans_sponsor_attendee_idx" ON "scans" ("sponsor_id", "attendee_id");
CREATE INDEX "scans_event_idx" ON "scans" ("event_id");

CREATE TABLE "outcomes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "event_id" uuid NOT NULL REFERENCES "events"("id") ON DELETE CASCADE,
  "sponsor_id" uuid NOT NULL REFERENCES "sponsors"("id") ON DELETE CASCADE,
  "attendee_id" uuid NOT NULL REFERENCES "attendees"("id") ON DELETE CASCADE,
  "status" outcome_status NOT NULL DEFAULT 'no_follow_up',
  "notes" text NOT NULL DEFAULT '',
  "role" text,
  "captured_at" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "outcomes_sponsor_attendee_idx" ON "outcomes" ("sponsor_id", "attendee_id");
