from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Organizer
from app.schemas import OrganizerCreate, OrganizerOut

router = APIRouter(prefix="/organizers", tags=["organizers"])


@router.post("", response_model=OrganizerOut, status_code=201)
def create_organizer(payload: OrganizerCreate, db: Session = Depends(get_db)) -> Organizer:
    organizer = Organizer(
        name=payload.name,
        brand_assets=payload.brand_assets,
        contract_terms=payload.contract_terms,
    )
    db.add(organizer)
    db.commit()
    db.refresh(organizer)
    return organizer


@router.get("/{organizer_id}", response_model=OrganizerOut)
def get_organizer(organizer_id: uuid.UUID, db: Session = Depends(get_db)) -> Organizer:
    organizer = db.get(Organizer, organizer_id)
    if organizer is None:
        raise HTTPException(status_code=404, detail="organizer not found")
    return organizer
