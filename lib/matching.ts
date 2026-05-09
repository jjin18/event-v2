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

import type { Attendee, IcpDefinition, MatchStatus } from "@/db/schema";

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
