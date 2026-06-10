"""POST /assess — double-dummy assessment of a played deal. Solves the deal's
double-dummy table, derives the contract from the auction, and reports how it
fares versus the makeable / par results. Compute only; the UI narrates."""
from fastapi import APIRouter, HTTPException

from app import assessor
from app.schemas import AssessRequest, AssessResponse

router = APIRouter()


@router.post("/assess", response_model=AssessResponse)
def assess(req: AssessRequest):
    try:
        res = assessor.assess(req.deal, req.final_auction, req.dealer, req.vul)
    except ValueError as exc:
        raise HTTPException(422, str(exc))
    return AssessResponse(**res)
