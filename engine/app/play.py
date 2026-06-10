"""Double-dummy play oracle — the engine behind /play (interactive card play).

Stateless: the client sends the full deal, the contract (trump + declarer), and
every card played so far in order; this replays the position and returns

  * to_act        — the seat to play next,
  * trick         — the cards in the current (incomplete) trick, with seats,
  * legal         — each legal card for the seat to act, with its double-dummy
                    value (max tricks the SIDE TO ACT can still take after it),
  * declarer/defender trick counts so far, and whether the deal is complete.

The client orchestrates (it decides which seats a human controls and auto-plays
the rest by picking the highest-dd card); this service is a pure DD oracle.
Opening lead is by the declarer's left-hand opponent.
"""
from __future__ import annotations

SEATS = ["N", "E", "S", "W"]
STRAINS = {"C", "D", "H", "S", "NT"}
_RANK_VAL = {r: i for i, r in enumerate("23456789TJQKA", start=2)}
_RANK_CHAR = {"RA": "A", "RK": "K", "RQ": "Q", "RJ": "J", "RT": "T", "R9": "9",
              "R8": "8", "R7": "7", "R6": "6", "R5": "5", "R4": "4", "R3": "3", "R2": "2"}
_SUIT_CHAR = {"spades": "S", "hearts": "H", "diamonds": "D", "clubs": "C"}


def _next(seat: str) -> str:
    return SEATS[(SEATS.index(seat) + 1) % 4]


def _trick_winner(trick, trump):
    """trick: [(seat, 'SK'), ...] of 4. trump: 'S'/'H'/'D'/'C' or None (NT)."""
    led = trick[0][1][0]
    win_seat, win_suit, win_rank = trick[0][0], trick[0][1][0], trick[0][1][1]
    for seat, card in trick[1:]:
        suit, rank = card[0], card[1]
        if suit == win_suit:
            if _RANK_VAL[rank] > _RANK_VAL[win_rank]:
                win_seat, win_suit, win_rank = seat, suit, rank
        elif suit == trump and win_suit != trump:
            win_seat, win_suit, win_rank = seat, suit, rank
    return win_seat


def play_state(deal_pbn: str, strain: str, declarer: str, played) -> dict:
    """Return the play state at this position. Raises ValueError on bad input."""
    from endplay.dds import solve_board
    from endplay.types import Card, Deal, Denom, Player

    strain = str(strain).strip().upper()
    declarer = str(declarer).strip().upper()
    if strain not in STRAINS:
        raise ValueError("strain must be one of C, D, H, S, NT")
    if declarer not in SEATS:
        raise ValueError("declarer must be one of N, E, S, W")
    denom = {"S": Denom.spades, "H": Denom.hearts, "D": Denom.diamonds,
             "C": Denom.clubs, "NT": Denom.nt}[strain]
    player = {"N": Player.north, "E": Player.east, "S": Player.south, "W": Player.west}

    try:
        deal = Deal(deal_pbn)
    except Exception as exc:
        raise ValueError(f"invalid PBN deal: {exc}")
    deal.trump = denom
    leader = _next(declarer)            # opening leader = declarer's LHO
    deal.first = player[leader]

    trump = None if strain == "NT" else strain
    turn = leader
    trick = []          # current (incomplete) trick: [(seat, card)]
    ns = ew = 0
    for raw in played:
        card = str(raw).strip().upper()
        try:
            deal.play(Card(card))
        except Exception:
            raise ValueError(f"illegal or malformed play: {raw!r}")
        trick.append((turn, card))
        turn = _next(turn)
        if len(trick) == 4:
            w = _trick_winner(trick, trump)
            if w in ("N", "S"):
                ns += 1
            else:
                ew += 1
            turn = w
            trick = []

    declarer_ns = declarer in ("N", "S")
    legal = []
    if len(played) < 52:
        legal = [{"card": _SUIT_CHAR[c.suit.name] + _RANK_CHAR[c.rank.name], "dd": t}
                 for c, t in solve_board(deal)]

    return {
        "to_act": turn,
        "trick": [{"seat": s, "card": c} for s, c in trick],
        "declarer_tricks": ns if declarer_ns else ew,
        "defender_tricks": ew if declarer_ns else ns,
        "legal": legal,
        "complete": len(played) == 52,
    }
