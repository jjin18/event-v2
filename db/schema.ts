import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const eventStatus = pgEnum("event_status", [
  "draft",
  "open",
  "closed",
  "running",
  "completed",
  "cancelled",
]);

export const applicationStatus = pgEnum("application_status", [
  "pending",
  "auto_approved",
  "accepted",
  "rejected",
  "waitlisted",
]);

export const scanRating = pgEnum("scan_rating", [
  "strong_fit",
  "some_interest",
  "not_a_match",
]);

export const matchStatus = pgEnum("match_status", [
  "match",
  "partial",
  "no_match",
  "needs_review",
]);

export const outcomeStatus = pgEnum("outcome_status", [
  "no_follow_up",
  "contacted",
  "interviewing",
  "offered",
  "hired",
  "declined",
]);

export const events = pgTable("events", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  organizerName: text("organizer_name").notNull(),
  date: timestamp("date", { withTimezone: true }).notNull(),
  location: text("location").notNull().default(""),
  description: text("description").notNull().default(""),
  expectedAttendance: integer("expected_attendance").notNull().default(0),
  status: eventStatus("status").notNull().default("draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const attendees = pgTable(
  "attendees",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 320 }).notNull(),
    name: text("name").notNull().default(""),
    githubUsername: varchar("github_username", { length: 64 }),
    githubData: jsonb("github_data").$type<GitHubData | null>(),
    emailVerified: boolean("email_verified").notNull().default(false),
    emailVerifiedDomain: varchar("email_verified_domain", { length: 255 }),
    school: text("school"),
    currentRole: text("current_role"),
    classYear: varchar("class_year", { length: 16 }),
    claimsText: text("claims_text").notNull().default(""),
    confidenceScore: integer("confidence_score").notNull().default(0),
    applicationStatus: applicationStatus("application_status").notNull().default("pending"),
    decisionReason: text("decision_reason"),
    decidedBy: varchar("decided_by", { length: 255 }),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    qrCode: varchar("qr_code", { length: 64 }).notNull(),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    isWalkIn: boolean("is_walk_in").notNull().default(false),
    consents: jsonb("consents").$type<Record<string, boolean>>().notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("attendees_event_email_idx").on(table.eventId, table.email),
    uniqueIndex("attendees_qr_code_idx").on(table.qrCode),
    index("attendees_event_status_idx").on(table.eventId, table.applicationStatus),
  ],
);

export const emailVerifications = pgTable(
  "email_verifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 320 }).notNull(),
    code: varchar("code", { length: 12 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("email_verifications_email_idx").on(table.email)],
);

export const sponsors = pgTable("sponsors", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: uuid("event_id")
    .notNull()
    .references(() => events.id, { onDelete: "cascade" }),
  companyName: text("company_name").notNull(),
  contactEmail: varchar("contact_email", { length: 320 }).notNull(),
  baseFeeCents: integer("base_fee_cents").notNull().default(0),
  perMatchFeeCents: integer("per_match_fee_cents").notNull().default(0),
  capCents: integer("cap_cents").notNull().default(0),
  icpDefinition: jsonb("icp_definition").$type<IcpDefinition>().notNull(),
  boothStaffEmails: jsonb("booth_staff_emails").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const scans = pgTable(
  "scans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    sponsorId: uuid("sponsor_id")
      .notNull()
      .references(() => sponsors.id, { onDelete: "cascade" }),
    attendeeId: uuid("attendee_id")
      .notNull()
      .references(() => attendees.id, { onDelete: "cascade" }),
    scannerEmail: varchar("scanner_email", { length: 320 }).notNull(),
    rating: scanRating("rating").notNull(),
    note: varchar("note", { length: 100 }).notNull().default(""),
    matchStatus: matchStatus("match_status").notNull().default("needs_review"),
    matchReasoning: text("match_reasoning"),
    scannedAt: timestamp("scanned_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("scans_sponsor_attendee_idx").on(table.sponsorId, table.attendeeId),
    index("scans_event_idx").on(table.eventId),
  ],
);

export const attendeeMatches = pgTable(
  "attendee_matches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    sponsorId: uuid("sponsor_id")
      .notNull()
      .references(() => sponsors.id, { onDelete: "cascade" }),
    attendeeId: uuid("attendee_id")
      .notNull()
      .references(() => attendees.id, { onDelete: "cascade" }),
    status: matchStatus("status").notNull(),
    reasoning: text("reasoning").notNull().default(""),
    matchedCriteria: jsonb("matched_criteria").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    missingCriteria: jsonb("missing_criteria").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("attendee_matches_sponsor_attendee_idx").on(table.sponsorId, table.attendeeId),
    index("attendee_matches_event_status_idx").on(table.eventId, table.status),
  ],
);

export const outcomes = pgTable(
  "outcomes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    sponsorId: uuid("sponsor_id")
      .notNull()
      .references(() => sponsors.id, { onDelete: "cascade" }),
    attendeeId: uuid("attendee_id")
      .notNull()
      .references(() => attendees.id, { onDelete: "cascade" }),
    status: outcomeStatus("status").notNull().default("no_follow_up"),
    notes: text("notes").notNull().default(""),
    role: text("role"),
    capturedAt: timestamp("captured_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("outcomes_sponsor_attendee_idx").on(table.sponsorId, table.attendeeId),
  ],
);

export type Event = typeof events.$inferSelect;
export type Attendee = typeof attendees.$inferSelect;
export type NewAttendee = typeof attendees.$inferInsert;
export type Sponsor = typeof sponsors.$inferSelect;
export type Scan = typeof scans.$inferSelect;
export type AttendeeMatch = typeof attendeeMatches.$inferSelect;
export type Outcome = typeof outcomes.$inferSelect;

export type GitHubData = {
  login: string;
  id: number;
  name: string | null;
  bio: string | null;
  company: string | null;
  blog: string | null;
  location: string | null;
  publicRepos: number;
  followers: number;
  createdAt: string;
  topRepos: Array<{
    name: string;
    description: string | null;
    language: string | null;
    stars: number;
    updatedAt: string;
  }>;
  recentActivityDays: number | null;
};

export type IcpDefinition = {
  description: string;
  targetRoles: string[];
  seniorityBands: string[];
  requiredSkills: string[];
  niceToHaveSkills: string[];
  institutions: string[];
  institutionTier?: "top_30" | "any" | string;
  behavioralCriteria: string;
};
