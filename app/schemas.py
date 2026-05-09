from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models import (
    ApplicationDecisionValue,
    EventStatus,
    MatchStatus,
    OutcomeStatus,
    PaymentStatus,
    ScanRating,
)


class _ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class OrganizerCreate(BaseModel):
    name: str
    brand_assets: dict = Field(default_factory=dict)
    contract_terms: dict = Field(default_factory=dict)


class OrganizerOut(_ORMModel):
    id: uuid.UUID
    name: str
    status: str
    created_at: datetime


class EventCreate(BaseModel):
    organizer_id: uuid.UUID
    name: str
    date: date
    location: str = ""
    expected_attendance: int = 0
    icp_categories: dict = Field(default_factory=dict)


class EventOut(_ORMModel):
    id: uuid.UUID
    organizer_id: uuid.UUID
    name: str
    date: date
    location: str
    expected_attendance: int
    status: EventStatus


class SponsorCreate(BaseModel):
    company_name: str


class SponsorOut(_ORMModel):
    id: uuid.UUID
    company_name: str
    status: str


class ContractCreate(BaseModel):
    sponsor_id: uuid.UUID
    event_id: uuid.UUID
    base_fee_cents: int
    per_match_fee_cents: int
    cap_cents: int
    icp_definition: dict
    booth_staff: list = Field(default_factory=list)


class ContractOut(_ORMModel):
    id: uuid.UUID
    sponsor_id: uuid.UUID
    event_id: uuid.UUID
    base_fee_cents: int
    per_match_fee_cents: int
    cap_cents: int
    verified_match_count: int
    payment_status: PaymentStatus


class AttendeeCreate(BaseModel):
    primary_email: EmailStr
    profile_data: dict = Field(default_factory=dict)
    identity_verifications: list = Field(default_factory=list)
    consents: dict = Field(default_factory=dict)


class AttendeeOut(_ORMModel):
    id: uuid.UUID
    primary_email: EmailStr
    confidence_score: float
    created_at: datetime


class ApplicationDecisionCreate(BaseModel):
    event_id: uuid.UUID
    attendee_id: uuid.UUID
    decision: ApplicationDecisionValue
    decision_reason: str = ""
    decided_by: str = "system"


class ApplicationDecisionOut(_ORMModel):
    id: uuid.UUID
    event_id: uuid.UUID
    attendee_id: uuid.UUID
    decision: ApplicationDecisionValue
    decided_by: str
    decided_at: datetime | None


class ScanCreate(BaseModel):
    contract_id: uuid.UUID
    attendee_id: uuid.UUID
    booth_staff_id: str
    rating: ScanRating
    memo_text: str = ""
    memo_audio_url: str | None = None


class ScanOut(_ORMModel):
    id: uuid.UUID
    contract_id: uuid.UUID
    attendee_id: uuid.UUID
    rating: ScanRating
    match_status: MatchStatus
    scanned_at: datetime


class OutcomeUpsert(BaseModel):
    event_id: uuid.UUID
    sponsor_id: uuid.UUID
    attendee_id: uuid.UUID
    status: OutcomeStatus
    captured_via: str = "sponsor_report"
    role: str | None = None
    salary_range: str | None = None


class OutcomeOut(_ORMModel):
    id: uuid.UUID
    event_id: uuid.UUID
    sponsor_id: uuid.UUID
    attendee_id: uuid.UUID
    status: OutcomeStatus
    captured_at: datetime
