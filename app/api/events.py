from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Event, Organizer
from app.schemas import EventCreate, EventOut

router = APIRouter(prefix="/events", tags=["events"])


@router.post("", response_model=EventOut, status_code=201)
def create_event(payload: EventCreate, db: Session = Depends(get_db)) -> Event:
    if db.get(Organizer, payload.organizer_id) is None:
        raise HTTPException(status_code=404, detail="organizer not found")
    event = Event(
        organizer_id=payload.organizer_id,
        name=payload.name,
        date=payload.date,
        location=payload.location,
        expected_attendance=payload.expected_attendance,
        icp_categories=payload.icp_categories,
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@router.get("/{event_id}", response_model=EventOut)
def get_event(event_id: uuid.UUID, db: Session = Depends(get_db)) -> Event:
    event = db.get(Event, event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="event not found")
    return event
