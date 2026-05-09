from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.matching import validate_icp
from app.models import Contract, Event, Sponsor
from app.schemas import ContractCreate, ContractOut, SponsorCreate, SponsorOut

router = APIRouter(prefix="/sponsors", tags=["sponsors"])


@router.post("", response_model=SponsorOut, status_code=201)
def create_sponsor(payload: SponsorCreate, db: Session = Depends(get_db)) -> Sponsor:
    sponsor = Sponsor(company_name=payload.company_name)
    db.add(sponsor)
    db.commit()
    db.refresh(sponsor)
    return sponsor


@router.post("/contracts", response_model=ContractOut, status_code=201)
def create_contract(payload: ContractCreate, db: Session = Depends(get_db)) -> Contract:
    if db.get(Sponsor, payload.sponsor_id) is None:
        raise HTTPException(status_code=404, detail="sponsor not found")
    if db.get(Event, payload.event_id) is None:
        raise HTTPException(status_code=404, detail="event not found")

    try:
        validate_icp(payload.icp_definition)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    if payload.cap_cents and payload.cap_cents < payload.base_fee_cents:
        raise HTTPException(status_code=422, detail="cap_cents must be >= base_fee_cents")

    contract = Contract(
        sponsor_id=payload.sponsor_id,
        event_id=payload.event_id,
        base_fee_cents=payload.base_fee_cents,
        per_match_fee_cents=payload.per_match_fee_cents,
        cap_cents=payload.cap_cents,
        icp_definition=payload.icp_definition,
        booth_staff=payload.booth_staff,
    )
    db.add(contract)
    db.commit()
    db.refresh(contract)
    return contract


@router.get("/contracts/{contract_id}", response_model=ContractOut)
def get_contract(contract_id: uuid.UUID, db: Session = Depends(get_db)) -> Contract:
    contract = db.get(Contract, contract_id)
    if contract is None:
        raise HTTPException(status_code=404, detail="contract not found")
    return contract
