from fastapi import APIRouter, HTTPException
from app.schemas import ExplainRequest, ExplainResponse

router = APIRouter()


@router.post("/explain", response_model=ExplainResponse)
def explain(_req: ExplainRequest):
    # Engines decide; this layer only narrates. Templated first, LLM optional.
    raise HTTPException(status_code=501, detail="Explanation layer not implemented.")
