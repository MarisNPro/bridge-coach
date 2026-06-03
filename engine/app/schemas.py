"""Request/response contracts for the engine service.

Phase 1 wires the bidding endpoints (/bid, /conformance, /explain) to the
system-as-data bidder. /assess (double-dummy) remains a Phase-1 stub until
the DDS spike lands.
"""
from pydantic import BaseModel, Field


# --- /bid -----------------------------------------------------------------
class BidRequest(BaseModel):
    hand: str = Field(..., description="Dotted S.H.D.C holding, e.g. 'AK1064.K3.Q542.J7'")
    auction: list[str] = Field(default_factory=list,
                               description="Calls so far; opponents in (parentheses), e.g. ['1C','(1S)']")
    system_id: str = "natural-v1"
    seat: str | None = Field(None, description="Disambiguates auctions used by two seats (e.g. opener vs responder)")


class BidResponse(BaseModel):
    call: str
    meaning: str
    promised: dict | None = None
    situation_id: str


# --- /conformance ---------------------------------------------------------
class ConformanceRequest(BaseModel):
    hand: str
    auction: list[str] = Field(default_factory=list)
    call: str = Field(..., description="The student's actual call, to grade")
    system_id: str = "natural-v1"
    seat: str | None = None


class ConformanceResponse(BaseModel):
    conformant: bool
    your_call: str
    expected_call: str | None
    expected_meaning: str
    expected_promised: dict | None = None
    situation_id: str


# --- /explain -------------------------------------------------------------
class ExplainRequest(BaseModel):
    auction: list[str] = Field(default_factory=list)
    call: str = Field(..., description="The call to explain in this auction context")
    system_id: str = "natural-v1"
    seat: str | None = None


class ExplainResponse(BaseModel):
    text: str
    meaning: str | None = None
    promised: dict | None = None
    situation_id: str


# --- /assess (Phase 1, still stubbed) -------------------------------------
class AssessRequest(BaseModel):
    deal: str          # full deal (PBN)
    final_auction: list[str]


class AssessResponse(BaseModel):
    makeable_contracts: dict
    optimal_result: str
    conformance: bool
