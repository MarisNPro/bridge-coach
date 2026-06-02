"""Request/response contracts for the engine service.

These mirror the API sketch in the technical plan. In Phase 0 the
handlers are stubs; the shapes are fixed now so the web app and the
engine agree on the contract before any bridge logic exists.
"""
from pydantic import BaseModel


class BidRequest(BaseModel):
    hand: str          # e.g. PBN holding for one seat
    auction: list[str] # calls so far, e.g. ["1H", "Pass", "2H"]
    system_id: str


class BidResponse(BaseModel):
    call: str
    meaning: str
    promised_range: str | None = None


class AssessRequest(BaseModel):
    deal: str          # full deal (PBN)
    final_auction: list[str]


class AssessResponse(BaseModel):
    makeable_contracts: dict
    optimal_result: str
    conformance: bool


class ExplainRequest(BaseModel):
    context: dict
    verdict: dict


class ExplainResponse(BaseModel):
    text: str
