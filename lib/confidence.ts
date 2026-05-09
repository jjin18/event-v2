/**
 * M1 confidence scoring (PRD §6.1, M1 plan §"What to build" Week 2).
 *
 * Score is stored as integer 0-100 to avoid float-rounding issues in the DB.
 * Threshold for auto-approval is 70 (M1 plan).
 */

import type { GitHubData } from "@/db/schema";

const KNOWN_INSTITUTION_DOMAINS = new Set([
  "stanford.edu",
  "mit.edu",
  "harvard.edu",
  "berkeley.edu",
  "cmu.edu",
  "princeton.edu",
  "yale.edu",
  "columbia.edu",
  "cornell.edu",
  "uchicago.edu",
  "caltech.edu",
  "umich.edu",
  "gatech.edu",
  "uiuc.edu",
  "utexas.edu",
  "uw.edu",
  "ucla.edu",
  "ucsd.edu",
  "nyu.edu",
  "northwestern.edu",
]);

export type ConfidenceInput = {
  github: GitHubData | null;
  emailDomain: string | null;
  emailVerified: boolean;
  claimsText: string;
  school: string | null;
};

export type ConfidenceBreakdown = {
  score: number;
  signals: Array<{ source: string; weight: number; reason: string }>;
};

export function computeConfidence(input: ConfidenceInput): ConfidenceBreakdown {
  const signals: Array<{ source: string; weight: number; reason: string }> = [
    { source: "baseline", weight: 10, reason: "submitted application" },
  ];

  if (input.github) {
    const accountAgeDays = daysSince(input.github.createdAt);
    if (accountAgeDays !== null && accountAgeDays > 365) {
      signals.push({
        source: "github_account_age",
        weight: 15,
        reason: `account ${Math.floor(accountAgeDays / 365)} years old`,
      });
    } else if (accountAgeDays !== null && accountAgeDays > 90) {
      signals.push({
        source: "github_account_age",
        weight: 5,
        reason: `account ${accountAgeDays} days old`,
      });
    }

    if (input.github.publicRepos >= 3) {
      signals.push({
        source: "github_repos",
        weight: 15,
        reason: `${input.github.publicRepos} public repos`,
      });
    } else if (input.github.publicRepos >= 1) {
      signals.push({
        source: "github_repos",
        weight: 5,
        reason: `${input.github.publicRepos} public repos`,
      });
    }

    if (input.github.recentActivityDays !== null && input.github.recentActivityDays < 90) {
      signals.push({
        source: "github_recent_activity",
        weight: 10,
        reason: `pushed within last ${input.github.recentActivityDays} days`,
      });
    }
  }

  if (input.emailVerified && input.emailDomain) {
    if (KNOWN_INSTITUTION_DOMAINS.has(input.emailDomain.toLowerCase())) {
      signals.push({
        source: "email_domain",
        weight: 30,
        reason: `verified ${input.emailDomain} (known top-30 school)`,
      });
    } else if (input.emailDomain.endsWith(".edu")) {
      signals.push({
        source: "email_domain",
        weight: 20,
        reason: `verified .edu (${input.emailDomain})`,
      });
    } else {
      signals.push({
        source: "email_domain",
        weight: 10,
        reason: `verified ${input.emailDomain}`,
      });
    }
  }

  if (input.github && input.school) {
    const githubText = [
      input.github.bio ?? "",
      input.github.company ?? "",
      input.github.location ?? "",
    ]
      .join(" ")
      .toLowerCase();
    if (githubText.includes(input.school.toLowerCase())) {
      signals.push({
        source: "claims_consistency",
        weight: 10,
        reason: "GitHub bio/company mentions claimed school",
      });
    }
  }

  if (input.claimsText.trim().length >= 80) {
    signals.push({
      source: "claims_quality",
      weight: 5,
      reason: "wrote substantive claims text",
    });
  }

  const total = signals.reduce((acc, s) => acc + s.weight, 0);
  const score = Math.min(100, Math.max(0, total));
  return { score, signals };
}

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}
