"""POST /conformance — grade a student's call against the system. Conformant
iff it matches the system's prescribed call for the hand; otherwise returns
the expected call + meaning so the narration layer can explain the gap."""
from fastapi import APIRouter, HTTPException

from app import bidder
from app.log import logger
from app.schemas import ConformanceRequest, ConformanceResponse

router = APIRouter()


@router.post("/conformance", response_model=ConformanceResponse)
def conformance(req: ConformanceRequest):
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
        res = bidder.conformance(system, req.auction, hand, req.call, req.seat, toggles=req.toggles, preset=req.preset)
    except LookupError as exc:
        raise HTTPException(422, str(exc))

    logger.info("conformance %s call=%s expected=%s conformant=%s",
                res["situation_id"], res["your_call"], res["expected_call"], res["conformant"])
    return ConformanceResponse(
        conformant=res["conformant"],
        your_call=res["your_call"],
        expected_call=res["expected_call"],
        expected_meaning=res["expected_meaning"],
        expected_promised=res["expected_promised"],
        situation_id=res["situation_id"],
    )
