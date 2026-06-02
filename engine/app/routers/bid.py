from fastapi import APIRouter, HTTPException
from app.schemas import BidRequest, BidResponse

router = APIRouter()


@router.post("/bid", response_model=BidResponse)
def bid(_req: BidRequest):
    # Phase 1: the system bidder produces the call + meaning from system-as-data.
    raise HTTPException(status_code=501, detail="System bidder not implemented (Phase 1).")
