"""ICP matching engine — v0 rule-based stub.

Section 6.2 of the PRD: structured ICP criteria, deterministic match decisions,
human-readable explanation. LLM-assisted matching is a v2 enhancement.

Demographic criteria (race, gender, religion, age beyond seniority context) are
explicitly rejected here per the PRD's "must not" list.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.models import MatchStatus


PROHIBITED_ICP_FIELDS = {"race", "gender", "religion", "ethnicity", "age"}


@dataclass
class MatchResult:
    status: MatchStatus
    explanation: str
    matched_criteria: list[str]
    missing_criteria: list[str]


def validate_icp(icp: dict) -> None:
    prohibited = PROHIBITED_ICP_FIELDS & set(icp.keys())
    if prohibited:
        raise ValueError(f"ICP definition uses prohibited fields: {sorted(prohibited)}")


def evaluate(attendee_profile: dict, icp: dict) -> MatchResult:
    validate_icp(icp)

    matched: list[str] = []
    missing: list[str] = []

    role_categories = icp.get("role_categories")
    if role_categories:
        if attendee_profile.get("role") in role_categories:
            matched.append(f"role={attendee_profile['role']}")
        else:
            missing.append(f"role not in {role_categories}")

    seniority_bands = icp.get("seniority_bands")
    if seniority_bands:
        if attendee_profile.get("seniority") in seniority_bands:
            matched.append(f"seniority={attendee_profile['seniority']}")
        else:
            missing.append(f"seniority not in {seniority_bands}")

    skill_markers = set(icp.get("skill_markers") or [])
    if skill_markers:
        attendee_skills = set(attendee_profile.get("skills") or [])
        overlap = skill_markers & attendee_skills
        if overlap:
            matched.append(f"skills={sorted(overlap)}")
        else:
            missing.append(f"none of skills {sorted(skill_markers)} present")

    institutions = set(icp.get("institutions") or [])
    if institutions:
        attendee_institutions = set(attendee_profile.get("institutions") or [])
        overlap = institutions & attendee_institutions
        if overlap:
            matched.append(f"institution={sorted(overlap)}")
        else:
            missing.append(f"institution not in {sorted(institutions)}")

    if not matched and not missing:
        return MatchResult(
            status=MatchStatus.needs_review,
            explanation="ICP defined no evaluable criteria",
            matched_criteria=[],
            missing_criteria=[],
        )

    if missing and not matched:
        status = MatchStatus.no_match
    elif missing:
        status = MatchStatus.partial
    else:
        status = MatchStatus.match

    explanation = (
        f"matched: {matched}; missing: {missing}" if missing else f"matched: {matched}"
    )
    return MatchResult(
        status=status,
        explanation=explanation,
        matched_criteria=matched,
        missing_criteria=missing,
    )
