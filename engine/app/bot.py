"""Non-cheating Monte-Carlo card chooser (the Phase-B play bot).

The bot decides a card using ONLY what it may legally see — its own hand, the
dummy once it is revealed, and the cards already played. The concealed hands are
never sent to this function, so it cannot cheat by construction. For each legal
card it samples consistent layouts of the unknown cards, double-dummy-solves
each, and picks the card with the best average outcome for its own side.

This is the standard "double-dummy Monte-Carlo" technique. Auction-aware
sampling (constraining layouts by the bidding) is a later refinement; this
samples uniformly over consistent layouts.
"""
from __future__ import annotations

import random

from app.play import _next, _trick_winner, _RANK_CHAR, _SUIT_CHAR

SEATS = ["N", "E", "S", "W"]
SUITS = "SHDC"
RANKS = "AKQJT98765432"
STRAINS = {"C", "D", "H", "S", "NT"}
_RANK_ORDER = {r: i for i, r in enumerate(RANKS)}


def _full_deck() -> list[str]:
    return [s + r for s in SUITS for r in RANKS]


def _parse_holding(dotted: str) -> set[str]:
    parts = str(dotted).strip().upper().replace("10", "T").split(".")
    if len(parts) != 4:
        raise ValueError("each holding must be dotted 'S.H.D.C'")
    cards = set()
    for suit, seg in zip(SUITS, parts):
        for r in seg:
            if r not in RANKS:
                raise ValueError(f"invalid card '{r}'")
            cards.add(suit + r)
    return cards


def _fmt_hand(cards) -> str:
    by = {s: [] for s in SUITS}
    for c in cards:
        by[c[0]].append(c[1])
    return ".".join("".join(sorted(by[s], key=lambda r: _RANK_ORDER[r])) for s in SUITS)


def suggest_card(known_hands: dict, played, strain: str, declarer: str,
                 samples: int = 20, seed=None) -> dict:
    """Pick a card for the seat to act, seeing only `known_hands` (original
    13-card holdings of the bot's own seat and any revealed seat e.g. dummy).
    Raises ValueError on inconsistent input."""
    from endplay.dds import solve_board
    from endplay.types import Card, Deal, Denom, Player

    strain = str(strain).strip().upper()
    declarer = str(declarer).strip().upper()
    if strain not in STRAINS:
        raise ValueError("strain must be one of C, D, H, S, NT")
    if declarer not in SEATS:
        raise ValueError("declarer must be one of N, E, S, W")

    known = {s.upper(): _parse_holding(h) for s, h in (known_hands or {}).items()}
    if not known:
        raise ValueError("at least the bot's own hand must be provided")
    if any(s not in SEATS for s in known):
        raise ValueError("known hands must be keyed by seat (N/E/S/W)")

    played = [str(c).strip().upper().replace("10", "T") for c in played or []]
    leader = _next(declarer)
    trump = None if strain == "NT" else strain

    # Replay the rotation to find the seat to act, the in-progress trick, and
    # how many cards each seat has played.
    turn = leader
    played_by = {s: [] for s in SEATS}
    trick = []
    for card in played:
        played_by[turn].append(card)
        trick.append((turn, card))
        turn = _next(turn)
        if len(trick) == 4:
            turn = _trick_winner(trick, trump)
            trick = []
    to_act = turn
    if to_act not in known:
        raise ValueError("the seat to act must be one of the known hands")

    concealed = [s for s in SEATS if s not in known]
    known_union = set().union(*known.values())
    concealed_played = {c for s in concealed for c in played_by[s]}
    pool = [c for c in _full_deck() if c not in known_union and c not in concealed_played]
    need = {s: 13 - len(played_by[s]) for s in concealed}
    if sum(need.values()) != len(pool):
        raise ValueError("card accounting mismatch (overlapping or missing cards)")

    denom = {"S": Denom.spades, "H": Denom.hearts, "D": Denom.diamonds,
             "C": Denom.clubs, "NT": Denom.nt}[strain]
    pl = {"N": Player.north, "E": Player.east, "S": Player.south, "W": Player.west}
    rng = random.Random(seed)
    samples = max(1, min(int(samples), 200))

    score: dict[str, int] = {}
    for _ in range(samples):
        deck = pool[:]
        rng.shuffle(deck)
        i = 0
        hands = {s: set(known[s]) for s in known}
        for s in concealed:
            hands[s] = set(played_by[s]) | set(deck[i:i + need[s]])
            i += need[s]
        pbn = "N:" + " ".join(_fmt_hand(hands[s]) for s in SEATS)
        deal = Deal(pbn)
        deal.trump = denom
        deal.first = pl[leader]
        for card in played:
            deal.play(Card(card))
        for c, tricks in solve_board(deal):
            cc = _SUIT_CHAR[c.suit.name] + _RANK_CHAR[c.rank.name]
            score[cc] = score.get(cc, 0) + tricks  # tricks for the side to act

    # solve_board scores the side to act, which is the bot's side — maximise it.
    candidates = sorted(score, key=lambda c: score[c], reverse=True)
    return {
        "card": candidates[0],
        "to_act": to_act,
        "samples": samples,
        "candidates": [{"card": c, "avg_tricks": round(score[c] / samples, 2)} for c in candidates],
    }
