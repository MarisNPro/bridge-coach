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


class SystemResponse(BaseModel):
    id: str
    name: str
    toggles: dict        # the system's coach-amendable knobs (read-only for now)
    situations: int
    rules: int


class ExplainResponse(BaseModel):
    text: str
    meaning: str | None = None
    promised: dict | None = None
    situation_id: str
    variants: list[dict] = []   # every rule whose call matches (meaning/promised)


# --- /assess --------------------------------------------------------------
class AssessRequest(BaseModel):
    deal: str = Field(..., description="Full deal in PBN, e.g. 'N:AK2... E:... S:... W:...'")
    final_auction: list[str] = Field(default_factory=list,
                                     description="Complete auction, clockwise from the dealer (plain calls)")
    dealer: str = Field("N", description="Seat that made the first call: N, E, S, or W")
    vul: str = Field("none", description="Vulnerability for par scoring: none, ns, ew, both")


class AssessResponse(BaseModel):
    contract: str | None            # e.g. "4S", "3NTX", or None if passed out
    declarer: str | None            # N / E / S / W
    tricks_made: int | None         # double-dummy tricks the declarer takes
    result: int | None              # tricks relative to the contract (e.g. -1, 0, +2)
    makes: bool                     # does the contract make double-dummy?
    conformance: bool               # reached a contract that makes double-dummy
    optimal_result: str             # par contract(s)
    makeable_contracts: dict        # double-dummy table: {seat: {strain: tricks}}


# --- /play (interactive double-dummy play) --------------------------------
class PlayRequest(BaseModel):
    deal: str = Field(..., description="Full deal in PBN")
    strain: str = Field(..., description="Trump strain: C, D, H, S, or NT")
    declarer: str = Field(..., description="Declarer seat: N, E, S, or W")
    played: list[str] = Field(default_factory=list,
                              description="Cards played so far in order, e.g. ['S2','SK',...] (suit+rank, T=ten)")


class TrickCard(BaseModel):
    seat: str
    card: str


class LegalCard(BaseModel):
    card: str
    dd: int      # double-dummy tricks the side to act can still take after this card


class PlayResponse(BaseModel):
    to_act: str                  # seat to play next
    trick: list[TrickCard]       # current incomplete trick
    declarer_tricks: int
    defender_tricks: int
    legal: list[LegalCard]
    complete: bool
