from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Outcome
from app.schemas import OutcomeOut, OutcomeUpsert

router = APIRouter(prefix="/outcomes", tags=["outcomes"])


@router.post("", response_model=OutcomeOut, status_code=201)
def upsert_outcome(payload: OutcomeUpsert, db: Session = Depends(get_db)) -> Outcome:
    existing = db.scalar(
        select(Outcome).where(
            Outcome.event_id == payload.event_id,
            Outcome.sponsor_id == payload.sponsor_id,
            Outcome.attendee_id == payload.attendee_id,
        )
    )

    history_entry = {
        "status": payload.status.value,
        "captured_via": payload.captured_via,
        "at": datetime.now(timezone.utc).isoformat(),
    }

    if existing is None:
        outcome = Outcome(
            event_id=payload.event_id,
            sponsor_id=payload.sponsor_id,
            attendee_id=payload.attendee_id,
            status=payload.status,
            captured_via=payload.captured_via,
            role=payload.role,
            salary_range=payload.salary_range,
            status_history=[history_entry],
        )
        db.add(outcome)
    else:
        outcome = existing
        outcome.status = payload.status
        outcome.captured_via = payload.captured_via
        outcome.role = payload.role or outcome.role
        outcome.salary_range = payload.salary_range or outcome.salary_range
        outcome.status_history = [*outcome.status_history, history_entry]

    db.commit()
    db.refresh(outcome)
    return outcome


@router.get("/by-event/{event_id}", response_model=list[OutcomeOut])
def list_outcomes_for_event(event_id: uuid.UUID, db: Session = Depends(get_db)) -> list[Outcome]:
    return list(db.scalars(select(Outcome).where(Outcome.event_id == event_id)))
