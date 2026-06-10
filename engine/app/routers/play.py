"""POST /play — double-dummy play oracle for interactive card play. Given the
deal, contract, and cards played so far, returns whose turn it is, the legal
cards with their double-dummy values, and trick counts. Compute only."""
from fastapi import APIRouter, HTTPException

from app import play as play_engine
from app.schemas import PlayRequest, PlayResponse

router = APIRouter()


@router.post("/play", response_model=PlayResponse)
def play(req: PlayRequest):
    try:
        res = play_engine.play_state(req.deal, req.strain, req.declarer, req.played)
    except ValueError as exc:
        raise HTTPException(422, str(exc))
    return PlayResponse(**res)
