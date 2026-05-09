"""Identity confidence scoring — section 6.1 of the PRD.

OAuth integrations themselves (LinkedIn, GitHub, email-domain) live in separate
adapters. This module computes the confidence score from already-collected
verification records.
"""

from __future__ import annotations

SOURCE_BASE_SCORES = {
    "linkedin_oauth": 0.5,
    "github_oauth": 0.5,
    "email_domain": 0.3,
    "twitter_oauth": 0.2,
    "orcid": 0.4,
    "personal_website": 0.1,
}

CONSISTENCY_BONUS = 0.15


def compute_confidence(verifications: list[dict]) -> float:
    """Confidence score in [0, 1].

    A verification record is a dict with at least:
      - source (str): one of SOURCE_BASE_SCORES keys
      - data (dict): canonical facts pulled from the source
    """
    if not verifications:
        return 0.0

    sources = {v["source"] for v in verifications}
    base = sum(SOURCE_BASE_SCORES.get(s, 0.0) for s in sources)

    bonus = 0.0
    if len(sources) >= 2:
        names = {_normalize(v.get("data", {}).get("name")) for v in verifications}
        names.discard(None)
        if len(names) == 1:
            bonus += CONSISTENCY_BONUS

    return min(1.0, round(base + bonus, 2))


def _normalize(value: str | None) -> str | None:
    if not value:
        return None
    return value.strip().lower()
