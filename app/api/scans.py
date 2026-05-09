from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import get_db
from app.matching import evaluate
from app.models import Attendee, Contract, MatchStatus, Scan
from app.schemas import ScanCreate, ScanOut

router = APIRouter(prefix="/scans", tags=["scans"])


@router.post("", response_model=ScanOut, status_code=201)
def record_scan(payload: ScanCreate, db: Session = Depends(get_db)) -> Scan:
    contract = db.get(Contract, payload.contract_id)
    if contract is None:
        raise HTTPException(status_code=404, detail="contract not found")

    attendee = db.get(Attendee, payload.attendee_id)
    if attendee is None:
        raise HTTPException(status_code=404, detail="attendee not found")

    match = evaluate(attendee.profile_data, contract.icp_definition)

    scan = Scan(
        contract_id=contract.id,
        event_id=contract.event_id,
        sponsor_id=contract.sponsor_id,
        attendee_id=attendee.id,
        booth_staff_id=payload.booth_staff_id,
        rating=payload.rating,
        memo_text=payload.memo_text,
        memo_audio_url=payload.memo_audio_url,
        match_status=match.status,
    )
    db.add(scan)

    contract.audit_log = [
        *contract.audit_log,
        {
            "actor": payload.booth_staff_id,
            "event": "scan_recorded",
            "match_status": match.status.value,
            "explanation": match.explanation,
            "at": datetime.now(timezone.utc).isoformat(),
        },
    ]

    if match.status == MatchStatus.match:
        contract.verified_match_count = (contract.verified_match_count or 0) + 1

    db.commit()
    db.refresh(scan)
    return scan


@router.get("/by-contract/{contract_id}", response_model=list[ScanOut])
def list_scans(contract_id: uuid.UUID, db: Session = Depends(get_db)) -> list[Scan]:
    return list(db.scalars(select(Scan).where(Scan.contract_id == contract_id)))
