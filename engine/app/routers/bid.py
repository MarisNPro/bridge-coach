"""POST /bid — the system bot. Given a hand + auction, return the system's
call with its meaning and what it promises partner."""
from fastapi import APIRouter, HTTPException

from app import bidder
from app.log import logger
from app.schemas import BidRequest, BidResponse

router = APIRouter()


@router.post("/bid", response_model=BidResponse)
def bid(req: BidRequest):
    try:
        system = bidder.load_system(req.system_id)
    except FileNotFoundError:
        raise HTTPException(404, f"Unknown system '{req.system_id}'")
    try:
        hand = bidder.parse_hand(req.hand)
        bidder.validate_toggles_override(req.toggles)
    except ValueError as exc:
        raise HTTPException(422, str(exc))
    try:
        res = bidder.decide(system, req.auction, hand, req.seat, toggles=req.toggles, preset=req.preset)
    except LookupError as exc:
        raise HTTPException(422, str(exc))

    if res["call"] is None:
        raise HTTPException(500, "No rule matched; system data lacks a catch-all.")
    logger.info("bid %s -> %s", res["situation_id"], res["call"])
    return BidResponse(
        call=res["call"],
        meaning=res["meaning"],
        promised=res["promised"],
        situation_id=res["situation_id"],
    )
