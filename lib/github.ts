import { Octokit } from "@octokit/rest";

import type { GitHubData } from "@/db/schema";

function octokit(): Octokit {
  return new Octokit({ auth: process.env.GITHUB_TOKEN });
}

export async function fetchGitHubProfile(username: string): Promise<GitHubData | null> {
  const client = octokit();

  try {
    const { data: user } = await client.users.getByUsername({ username });

    const { data: repos } = await client.repos.listForUser({
      username,
      sort: "updated",
      per_page: 10,
      type: "owner",
    });

    const topRepos = repos
      .filter((r) => !r.fork)
      .slice(0, 5)
      .map((r) => ({
        name: r.name,
        description: r.description ?? null,
        language: r.language ?? null,
        stars: r.stargazers_count ?? 0,
        updatedAt: r.updated_at ?? "",
      }));

    const recentActivityDays = mostRecentRepoAgeDays(repos.map((r) => r.updated_at));

    return {
      login: user.login,
      id: user.id,
      name: user.name,
      bio: user.bio,
      company: user.company,
      blog: user.blog,
      location: user.location,
      publicRepos: user.public_repos,
      followers: user.followers,
      createdAt: user.created_at,
      topRepos,
      recentActivityDays,
    };
  } catch (error) {
    if (error instanceof Error && "status" in error && (error as { status: number }).status === 404) {
      return null;
    }
    throw error;
  }
}

function mostRecentRepoAgeDays(timestamps: Array<string | null | undefined>): number | null {
  const now = Date.now();
  let earliestAgeMs = Number.POSITIVE_INFINITY;
  for (const ts of timestamps) {
    if (!ts) continue;
    const ageMs = now - new Date(ts).getTime();
    if (ageMs < earliestAgeMs) earliestAgeMs = ageMs;
  }
  if (!Number.isFinite(earliestAgeMs)) return null;
  return Math.floor(earliestAgeMs / (1000 * 60 * 60 * 24));
}
