"""GET /system — the active bidding system's metadata and its coach-amendable
toggles (NT range, opening minimum, weak-two range, …). Read-only: the toggles
are surfaced for reference; the bidder does not yet apply them at runtime."""
from fastapi import APIRouter, HTTPException

from app import bidder
from app.schemas import SystemResponse

router = APIRouter()


@router.get("/system", response_model=SystemResponse)
def system(system_id: str = "natural-v1"):
    try:
        s = bidder.load_system(system_id)
    except FileNotFoundError:
        raise HTTPException(404, f"Unknown system '{system_id}'")
    sits = s.get("situations", [])
    return SystemResponse(
        id=s["id"],
        name=s.get("name", s["id"]),
        toggles=s.get("toggles", {}),
        situations=len(sits),
        rules=sum(len(x["rules"]) for x in sits),
    )
