/**
 * ICP matching engine (PRD §6.2).
 *
 * Uses Claude Opus 4.7 with adaptive thinking + structured outputs.
 * The sponsor ICP definition is identical for every attendee at the event,
 * so we cache it (system + ICP block) and let only the per-attendee data vary.
 *
 * Demographic ICP fields (race, gender, age beyond seniority, religion) are
 * rejected at the validate step, before the model is called.
 */

import Anthropic from "@anthropic-ai/sdk";
import { and, eq, inArray } from "drizzle-orm";

import type { Attendee, IcpDefinition } from "@/db/schema";
import { attendeeMatches, attendees, matchStatus, sponsors } from "@/db/schema";
import { db } from "@/lib/db";

type MatchStatus = (typeof matchStatus.enumValues)[number];

const PROHIBITED_ICP_FIELDS = new Set(["race", "gender", "ethnicity", "religion", "age"]);

const MATCH_SYSTEM_PROMPT = `You are an ICP (Ideal Customer Profile) match evaluator for a hackathon platform that pairs sponsors with attendees on a contingent contract basis. Sponsors only pay for verified ICP matches, so accurate, conservative judgment is critical.

Output one of four status values:
- "match": Every required dimension of the ICP is met. Sponsor will be billed for this match.
- "partial": At least one required dimension is met, others are absent or unclear.
- "no_match": No required dimensions are met, or there is clear evidence the attendee does not fit.
- "needs_review": You cannot make a confident judgment from the data provided.

Hard rules:
- Cite specific attendee data for every claim. Never invent facts.
- Do not consider race, gender, age, ethnicity, or religion. Refuse to use these as match criteria.
- Be conservative: when in doubt between "match" and "partial", choose "partial". When in doubt between "no_match" and "needs_review", choose "needs_review".
- Output a single JSON object that strictly matches the requested schema. No prose outside the JSON.`;

const MATCH_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: {
      type: "string",
      enum: ["match", "partial", "no_match", "needs_review"],
    },
    reasoning: {
      type: "string",
      description: "One or two sentences citing specific attendee data.",
    },
    matched_criteria: {
      type: "array",
      items: { type: "string" },
    },
    missing_criteria: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["status", "reasoning", "matched_criteria", "missing_criteria"],
} as const;

export type MatchResult = {
  status: MatchStatus;
  reasoning: string;
  matchedCriteria: string[];
  missingCriteria: string[];
};

export function validateIcp(icp: IcpDefinition): void {
  const keys = Object.keys(icp);
  const prohibited = keys.filter((k) => PROHIBITED_ICP_FIELDS.has(k.toLowerCase()));
  if (prohibited.length > 0) {
    throw new Error(`ICP definition uses prohibited fields: ${prohibited.join(", ")}`);
  }
}

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (!_client) _client = new Anthropic();
  return _client;
}

export async function evaluateMatch(
  attendee: Pick<
    Attendee,
    "name" | "school" | "currentRole" | "classYear" | "claimsText" | "githubData"
  >,
  icp: IcpDefinition,
): Promise<MatchResult> {
  validateIcp(icp);

  const icpBlock = renderIcpForPrompt(icp);
  const attendeeBlock = renderAttendeeForPrompt(attendee);

  const response = await client().messages.create({
    model: "claude-opus-4-7",
    max_tokens: 1024,
    thinking: { type: "adaptive" },
    output_config: {
      format: {
        type: "json_schema",
        schema: MATCH_OUTPUT_SCHEMA,
      },
    },
    system: [
      { type: "text", text: MATCH_SYSTEM_PROMPT },
      {
        type: "text",
        text: `Sponsor ICP for this event:\n\n${icpBlock}`,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [
      {
        role: "user",
        content: `Evaluate this attendee against the ICP above.\n\n${attendeeBlock}`,
      },
    ],
  });

  const parsed = extractJson(response);
  return {
    status: parsed.status as MatchStatus,
    reasoning: parsed.reasoning,
    matchedCriteria: parsed.matched_criteria,
    missingCriteria: parsed.missing_criteria,
  };
}

/**
 * Cache-aware match: returns a stored result if present, otherwise computes
 * via the LLM and writes the cache entry. Used by the booth scanner so we
 * don't pay the model call twice for the same (sponsor, attendee) pair.
 */
export async function getOrComputeMatch(
  sponsorId: string,
  eventId: string,
  attendee: Pick<
    Attendee,
    "id" | "name" | "school" | "currentRole" | "classYear" | "claimsText" | "githubData"
  >,
  icp: IcpDefinition,
): Promise<MatchResult> {
  const existing = await db.query.attendeeMatches.findFirst({
    where: and(
      eq(attendeeMatches.sponsorId, sponsorId),
      eq(attendeeMatches.attendeeId, attendee.id),
    ),
  });
  if (existing) {
    return {
      status: existing.status,
      reasoning: existing.reasoning,
      matchedCriteria: existing.matchedCriteria,
      missingCriteria: existing.missingCriteria,
    };
  }

  const result = await evaluateMatch(attendee, icp);
  await db
    .insert(attendeeMatches)
    .values({
      eventId,
      sponsorId,
      attendeeId: attendee.id,
      status: result.status,
      reasoning: result.reasoning,
      matchedCriteria: result.matchedCriteria,
      missingCriteria: result.missingCriteria,
    })
    .onConflictDoUpdate({
      target: [attendeeMatches.sponsorId, attendeeMatches.attendeeId],
      set: {
        status: result.status,
        reasoning: result.reasoning,
        matchedCriteria: result.matchedCriteria,
        missingCriteria: result.missingCriteria,
        computedAt: new Date(),
      },
    });

  return result;
}

/**
 * Batch pre-event matching: compute for every confirmed attendee at the event
 * for a given sponsor. Returns the count of newly computed matches. Existing
 * cached matches are skipped unless `force` is true.
 */
export async function recomputeEventMatches(
  sponsorId: string,
  options: { force?: boolean } = {},
): Promise<{ computed: number; cached: number; failed: number }> {
  const sponsor = await db.query.sponsors.findFirst({ where: eq(sponsors.id, sponsorId) });
  if (!sponsor) throw new Error(`sponsor ${sponsorId} not found`);

  const confirmed = await db.query.attendees.findMany({
    where: and(
      eq(attendees.eventId, sponsor.eventId),
      inArray(attendees.applicationStatus, ["accepted", "auto_approved"]),
    ),
  });

  if (options.force) {
    await db
      .delete(attendeeMatches)
      .where(eq(attendeeMatches.sponsorId, sponsorId));
  }

  let computed = 0;
  let cached = 0;
  let failed = 0;
  for (const attendee of confirmed) {
    const before = await db.query.attendeeMatches.findFirst({
      where: and(
        eq(attendeeMatches.sponsorId, sponsorId),
        eq(attendeeMatches.attendeeId, attendee.id),
      ),
    });
    if (before) {
      cached += 1;
      continue;
    }
    try {
      await getOrComputeMatch(sponsorId, sponsor.eventId, attendee, sponsor.icpDefinition);
      computed += 1;
    } catch {
      failed += 1;
    }
  }
  return { computed, cached, failed };
}

function renderIcpForPrompt(icp: IcpDefinition): string {
  const lines = [
    `Description: ${icp.description}`,
    `Target roles: ${icp.targetRoles.join(", ") || "(any)"}`,
    `Seniority bands: ${icp.seniorityBands.join(", ") || "(any)"}`,
    `Required skills: ${icp.requiredSkills.join(", ") || "(none)"}`,
    `Nice-to-have skills: ${icp.niceToHaveSkills.join(", ") || "(none)"}`,
    `Institutions: ${icp.institutions.join(", ") || "(any)"}`,
  ];
  if (icp.institutionTier) lines.push(`Institution tier: ${icp.institutionTier}`);
  if (icp.behavioralCriteria) lines.push(`Behavioral criteria: ${icp.behavioralCriteria}`);
  return lines.join("\n");
}

function renderAttendeeForPrompt(
  attendee: Pick<
    Attendee,
    "name" | "school" | "currentRole" | "classYear" | "claimsText" | "githubData"
  >,
): string {
  const gh = attendee.githubData;
  const ghLines = gh
    ? [
        `GitHub: ${gh.login} (${gh.publicRepos} repos, ${gh.followers} followers)`,
        gh.bio ? `Bio: ${gh.bio}` : null,
        gh.company ? `Company: ${gh.company}` : null,
        gh.location ? `Location: ${gh.location}` : null,
        `Top repos: ${gh.topRepos
          .map((r) => `${r.name} (${r.language ?? "?"}, ${r.stars}★${r.description ? `: ${r.description}` : ""})`)
          .join("; ")}`,
      ]
        .filter(Boolean)
        .join("\n")
    : "GitHub: (not connected)";

  return [
    `Name: ${attendee.name || "(not provided)"}`,
    `School: ${attendee.school ?? "(not provided)"}`,
    `Class year: ${attendee.classYear ?? "(not provided)"}`,
    `Current role: ${attendee.currentRole ?? "(not provided)"}`,
    "",
    ghLines,
    "",
    `Self-described focus: ${attendee.claimsText || "(none)"}`,
  ].join("\n");
}

function extractJson(response: Anthropic.Message): {
  status: string;
  reasoning: string;
  matched_criteria: string[];
  missing_criteria: string[];
} {
  for (const block of response.content) {
    if (block.type === "text") {
      const text = block.text.trim();
      try {
        const parsed = JSON.parse(text);
        return parsed;
      } catch {
        const match = text.match(/\{[\s\S]*\}/);
        if (match) return JSON.parse(match[0]);
      }
    }
  }
  throw new Error("ICP match response did not contain valid JSON");
}
