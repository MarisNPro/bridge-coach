"""Double-dummy assessment of a played deal (the engine behind /assess).

Given a full deal (PBN) and the final auction, this:
  * solves the double-dummy trick table for all four hands (endplay's DDS),
  * derives the contract from the auction — level, strain, declarer (the first
    of the contract-winning side to name the strain), and any double/redouble,
  * reports how the contract fares double-dummy and what the par result is.

Like the bidder, this service only computes; the LLM/UI narrates on top.

Auction convention for /assess: `final_auction` is the COMPLETE auction,
clockwise from the dealer, as plain calls (`1S`, `Pass`, `X`, `XX`, `2NT`, ...).
This differs from /bid, whose auctions carry only the partnership's calls with
opponents in (parentheses).
"""
from __future__ import annotations

from app.bidder import normalize_call

SEATS = ["N", "E", "S", "W"]
# Strain labels (call form). endplay's Denom/Player/Vul enums are resolved lazily
# inside assess() so importing this module never requires the native DDS library.
STRAINS = ["S", "H", "D", "C", "NT"]


def _parse_contract(auction, dealer: str) -> dict | None:
    """Walk the auction (clockwise from dealer) and return the final contract,
    or None if the deal was passed out. Raises ValueError on a malformed call.
    """
    start = SEATS.index(dealer)
    last_bid = None          # (level, strain)
    last_bidder = None       # seat letter
    doubled = 0              # 0 none, 1 doubled, 2 redoubled
    first_to_name = {}       # (partnership 0=NS/1=EW, strain) -> seat

    for i, raw in enumerate(auction):
        seat = SEATS[(start + i) % 4]
        call = normalize_call(str(raw).strip().lstrip("(").rstrip(")"))
        if call == "Pass":
            continue
        if call == "X":
            doubled = 1
            continue
        if call == "XX":
            doubled = 2
            continue
        # A contract bid: <level><strain>, e.g. 1S, 3NT.
        strain = call[1:]
        if not call[:1].isdigit() or strain not in STRAINS:
            raise ValueError(f"invalid call in auction: {raw!r}")
        level = int(call[0])
        last_bid, last_bidder, doubled = (level, strain), seat, 0
        partnership = SEATS.index(seat) % 2
        first_to_name.setdefault((partnership, strain), seat)

    if last_bid is None:
        return None
    level, strain = last_bid
    partnership = SEATS.index(last_bidder) % 2
    return {
        "level": level,
        "strain": strain,
        "declarer": first_to_name[(partnership, strain)],
        "doubled": doubled,
    }


def assess(deal_pbn: str, auction, dealer: str = "N", vul: str = "none") -> dict:
    """Assess a played deal double-dummy. Raises ValueError on bad input."""
    from endplay.dds import calc_dd_table, par
    from endplay.types import Deal, Denom, Player, Vul

    player = {"N": Player.north, "E": Player.east, "S": Player.south, "W": Player.west}
    denom = {"S": Denom.spades, "H": Denom.hearts, "D": Denom.diamonds,
             "C": Denom.clubs, "NT": Denom.nt}
    vuls = {"none": Vul.none, "ns": Vul.ns, "ew": Vul.ew, "both": Vul.both}

    dealer = str(dealer).strip().upper()
    if dealer not in SEATS:
        raise ValueError("dealer must be one of N, E, S, W")
    vul = str(vul).strip().lower()
    if vul not in vuls:
        raise ValueError("vul must be one of none, ns, ew, both")
    try:
        deal = Deal(deal_pbn)
    except Exception as exc:  # endplay raises various errors on malformed PBN
        raise ValueError(f"invalid PBN deal: {exc}")

    table = calc_dd_table(deal)
    makeable = {
        seat: {label: table[denom[label], player[seat]] for label in STRAINS}
        for seat in SEATS
    }
    par_list = par(table, vuls[vul], player[dealer])
    optimal = ", ".join(str(c) for c in par_list) or "Pass (nobody can make a contract)"

    contract = _parse_contract(auction, dealer)
    if contract is None:
        return {
            "contract": None, "declarer": None, "tricks_made": None,
            "result": None, "makes": False,
            "conformance": len(list(par_list)) == 0,  # passing out was right only on a flat deal
            "optimal_result": optimal, "makeable_contracts": makeable,
        }

    tricks = table[denom[contract["strain"]], player[contract["declarer"]]]
    needed = contract["level"] + 6
    result = tricks - needed
    makes = result >= 0
    suffix = {0: "", 1: "X", 2: "XX"}[contract["doubled"]]
    return {
        "contract": f"{contract['level']}{contract['strain']}{suffix}",
        "declarer": contract["declarer"],
        "tricks_made": tricks,
        "result": result,
        "makes": makes,
        "conformance": makes,
        "optimal_result": optimal,
        "makeable_contracts": makeable,
    }
