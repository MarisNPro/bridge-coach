from fastapi import APIRouter, HTTPException
from app.schemas import AssessRequest, AssessResponse

router = APIRouter()


@router.post("/assess", response_model=AssessResponse)
def assess(_req: AssessRequest):
    # Phase 1: DDS double-dummy solver + system conformance check.
    raise HTTPException(status_code=501, detail="Assessment not implemented (Phase 1).")
