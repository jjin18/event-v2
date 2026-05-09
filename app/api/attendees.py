from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.identity import compute_confidence
from app.models import Attendee
from app.schemas import AttendeeCreate, AttendeeOut

router = APIRouter(prefix="/attendees", tags=["attendees"])


@router.post("", response_model=AttendeeOut, status_code=201)
def register_attendee(payload: AttendeeCreate, db: Session = Depends(get_db)) -> Attendee:
    confidence = compute_confidence(payload.identity_verifications)

    attendee = Attendee(
        primary_email=payload.primary_email,
        profile_data=payload.profile_data,
        identity_verifications=payload.identity_verifications,
        confidence_score=confidence,
        consents=payload.consents,
    )
    db.add(attendee)
    db.commit()
    db.refresh(attendee)
    return attendee


@router.get("/{attendee_id}", response_model=AttendeeOut)
def get_attendee(attendee_id: uuid.UUID, db: Session = Depends(get_db)) -> Attendee:
    attendee = db.get(Attendee, attendee_id)
    if attendee is None:
        raise HTTPException(status_code=404, detail="attendee not found")
    return attendee
