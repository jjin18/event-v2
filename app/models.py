from __future__ import annotations

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import (
    JSON,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def _uuid() -> uuid.UUID:
    return uuid.uuid4()


class EventStatus(str, enum.Enum):
    draft = "draft"
    open = "open"
    closed = "closed"
    running = "running"
    completed = "completed"
    cancelled = "cancelled"


class ApplicationDecisionValue(str, enum.Enum):
    accepted = "accepted"
    rejected = "rejected"
    pending = "pending"


class ScanRating(str, enum.Enum):
    strong_fit = "strong_fit"
    some_interest = "some_interest"
    not_a_match = "not_a_match"


class MatchStatus(str, enum.Enum):
    match = "match"
    partial = "partial"
    no_match = "no_match"
    needs_review = "needs_review"


class OutcomeStatus(str, enum.Enum):
    no_follow_up = "no_follow_up"
    contacted = "contacted"
    interviewing = "interviewing"
    offered = "offered"
    hired = "hired"
    declined = "declined"


class PaymentStatus(str, enum.Enum):
    unbilled = "unbilled"
    invoiced = "invoiced"
    paid = "paid"
    failed = "failed"
    refunded = "refunded"


class Organizer(Base):
    __tablename__ = "organizers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String(255))
    brand_assets: Mapped[dict] = mapped_column(JSON, default=dict)
    contract_terms: Mapped[dict] = mapped_column(JSON, default=dict)
    payment_details: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(32), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    events: Mapped[list[Event]] = relationship(back_populates="organizer")


class Event(Base):
    __tablename__ = "events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    organizer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizers.id"))
    name: Mapped[str] = mapped_column(String(255))
    date: Mapped[date] = mapped_column(Date)
    location: Mapped[str] = mapped_column(String(255), default="")
    expected_attendance: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[EventStatus] = mapped_column(Enum(EventStatus), default=EventStatus.draft)
    brand_assets: Mapped[dict] = mapped_column(JSON, default=dict)
    schedule: Mapped[dict] = mapped_column(JSON, default=dict)
    icp_categories: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    organizer: Mapped[Organizer] = relationship(back_populates="events")
    sponsor_contracts: Mapped[list[Contract]] = relationship(back_populates="event")


class Sponsor(Base):
    __tablename__ = "sponsors"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    company_name: Mapped[str] = mapped_column(String(255))
    payment_method: Mapped[dict] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(32), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    contracts: Mapped[list[Contract]] = relationship(back_populates="sponsor")


class Attendee(Base):
    __tablename__ = "attendees"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    primary_email: Mapped[str] = mapped_column(String(255), unique=True)
    profile_data: Mapped[dict] = mapped_column(JSON, default=dict)
    identity_verifications: Mapped[list] = mapped_column(JSON, default=list)
    confidence_score: Mapped[float] = mapped_column(Numeric(3, 2), default=0)
    consents: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    application_decisions: Mapped[list[ApplicationDecision]] = relationship(back_populates="attendee")


class ApplicationDecision(Base):
    __tablename__ = "application_decisions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("events.id"))
    attendee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("attendees.id"))
    decision: Mapped[ApplicationDecisionValue] = mapped_column(
        Enum(ApplicationDecisionValue), default=ApplicationDecisionValue.pending
    )
    decision_reason: Mapped[str] = mapped_column(Text, default="")
    decided_by: Mapped[str] = mapped_column(String(64), default="system")
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    attendee: Mapped[Attendee] = relationship(back_populates="application_decisions")


class Contract(Base):
    __tablename__ = "contracts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    sponsor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sponsors.id"))
    event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("events.id"))
    base_fee_cents: Mapped[int] = mapped_column(Integer, default=0)
    per_match_fee_cents: Mapped[int] = mapped_column(Integer, default=0)
    cap_cents: Mapped[int] = mapped_column(Integer, default=0)
    icp_definition: Mapped[dict] = mapped_column(JSON, default=dict)
    booth_staff: Mapped[list] = mapped_column(JSON, default=list)
    verified_match_count: Mapped[int] = mapped_column(Integer, default=0)
    final_invoice_cents: Mapped[int] = mapped_column(Integer, default=0)
    payment_status: Mapped[PaymentStatus] = mapped_column(
        Enum(PaymentStatus), default=PaymentStatus.unbilled
    )
    audit_log: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    sponsor: Mapped[Sponsor] = relationship(back_populates="contracts")
    event: Mapped[Event] = relationship(back_populates="sponsor_contracts")
    scans: Mapped[list[Scan]] = relationship(back_populates="contract")


class Scan(Base):
    __tablename__ = "scans"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    contract_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("contracts.id"))
    event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("events.id"))
    sponsor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sponsors.id"))
    attendee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("attendees.id"))
    booth_staff_id: Mapped[str] = mapped_column(String(255))
    rating: Mapped[ScanRating] = mapped_column(Enum(ScanRating))
    memo_text: Mapped[str] = mapped_column(String(120), default="")
    memo_audio_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    match_status: Mapped[MatchStatus] = mapped_column(Enum(MatchStatus), default=MatchStatus.needs_review)
    match_status_reviewed: Mapped[MatchStatus | None] = mapped_column(
        Enum(MatchStatus), nullable=True
    )
    scanned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    contract: Mapped[Contract] = relationship(back_populates="scans")


class Outcome(Base):
    __tablename__ = "outcomes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=_uuid)
    event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("events.id"))
    sponsor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("sponsors.id"))
    attendee_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("attendees.id"))
    status: Mapped[OutcomeStatus] = mapped_column(Enum(OutcomeStatus), default=OutcomeStatus.no_follow_up)
    status_history: Mapped[list] = mapped_column(JSON, default=list)
    captured_via: Mapped[str] = mapped_column(String(64), default="sponsor_report")
    role: Mapped[str | None] = mapped_column(String(255), nullable=True)
    salary_range: Mapped[str | None] = mapped_column(String(64), nullable=True)
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
