"""POST /explain — the questions layer. What does a call mean / promise in a
given auction? Narration only; the meaning comes straight from the data."""
from fastapi import APIRouter, HTTPException

from app import bidder
from app.schemas import ExplainRequest, ExplainResponse

router = APIRouter()


@router.post("/explain", response_model=ExplainResponse)
def explain(req: ExplainRequest):
    try:
        system = bidder.load_system(req.system_id)
    except FileNotFoundError:
        raise HTTPException(404, f"Unknown system '{req.system_id}'")
    try:
        res = bidder.explain_call(system, req.auction, req.call, req.seat)
    except LookupError as exc:
        raise HTTPException(422, str(exc))

    if not res["found"]:
        text = f"{res['call']} is not a defined call in this situation."
        return ExplainResponse(text=text, situation_id=res["situation_id"])

    text = f"{res['call']}: {res['meaning']}"
    return ExplainResponse(
        text=text,
        meaning=res["meaning"],
        promised=res["promised"],
        situation_id=res["situation_id"],
        variants=res.get("variants", []),
    )
