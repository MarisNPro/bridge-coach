"""Canonical system bidder — the runtime engine behind /bid, /conformance,
and /explain.

It reads a system-as-data file (e.g. system/natural-v1.yaml) and answers the
three consumers described in system/schema.md without re-implementing any
bridge logic:

  * bot          -> decide(): first matching rule's call + meaning + promised
  * conformance  -> conformance(): is the student's call the system's call?
  * questions    -> explain_call(): what does this call mean / promise?

The feature/predicate logic is ported verbatim from the reference evaluator
(system/evaluate_spike.py), which validated the data against 85 hands. A
parity test (tests/test_parity.py) re-runs those cases against this module so
the two cannot drift.
"""
from __future__ import annotations

import os
import threading

import yaml

HCP_VALUE = {"A": 4, "K": 3, "Q": 2, "J": 1}
SUITS = ["spades", "hearts", "diamonds", "clubs"]
SYMBOL = {"spades": "S", "hearts": "H", "diamonds": "D", "clubs": "C"}
BALANCED_SHAPES = {(4, 3, 3, 3), (4, 4, 3, 2), (5, 3, 3, 2)}
RANKS = set("AKQJT98765432")

_CACHE: dict[str, dict] = {}
_LOCK = threading.Lock()


# --------------------------------------------------------------------------
# Loading + indexing
# --------------------------------------------------------------------------
def _system_path(system_id: str) -> str:
    base = os.path.join(os.path.dirname(__file__), "..", "system")
    return os.path.normpath(os.path.join(base, f"{system_id}.yaml"))


def load_system(system_id: str = "natural-v1") -> dict:
    """Load + index a system file, cached by id. Raises FileNotFoundError."""
    with _LOCK:
        cached = _CACHE.get(system_id)
        if cached is None:
            path = _system_path(system_id)
            if not os.path.exists(path):
                raise FileNotFoundError(system_id)
            with open(path, encoding="utf-8") as fh:
                data = yaml.safe_load(fh)
            _index(data)
            _CACHE[system_id] = data
            cached = data
        return cached


def _index(data: dict) -> None:
    """Precompute a normalized auction key + seat on each situation."""
    for sit in data.get("situations", []):
        when = sit.get("when", {}) or {}
        sit["_auction_key"] = tuple(normalize_auction(when.get("auction", []) or []))
        sit["_seat"] = when.get("seat")


# --------------------------------------------------------------------------
# Call / auction normalization
# --------------------------------------------------------------------------
def normalize_call(call: str) -> str:
    """Canonicalize a single call. Opponents' calls keep their (parentheses).

    Accepts loose input ('pass', 'p', 'dbl', '1nt', '(1s)') and returns the
    data's canonical form ('Pass', 'X', '1NT', '(1S)').
    """
    c = str(call).strip()
    paren = c.startswith("(") and c.endswith(")")
    inner = c[1:-1].strip() if paren else c
    up = inner.upper()
    if up in ("PASS", "P"):
        canon = "Pass"
    elif up in ("X", "DBL", "DOUBLE"):
        canon = "X"
    elif up in ("XX", "RDBL", "REDBL", "REDOUBLE"):
        canon = "XX"
    else:
        canon = up  # bids like 1NT, 1H, 2C, 3S, 4NT ...
    return f"({canon})" if paren else canon


def normalize_auction(auction) -> list[str]:
    return [normalize_call(c) for c in auction]


# --------------------------------------------------------------------------
# Hand parsing + features
# --------------------------------------------------------------------------
def parse_hand(hand) -> dict[str, str]:
    """Accept a dict {'S':..,'H':..,'D':..,'C':..} or a PBN-style dotted
    holding 'S.H.D.C' (e.g. 'AK1064.K3.Q542.J7'). 'T' or '10' both mean ten.
    """
    if isinstance(hand, dict):
        d = {k.upper(): str(v).upper().replace("10", "T") for k, v in hand.items()}
    else:
        s = str(hand).strip().upper().replace("10", "T")
        parts = s.split(".")
        if len(parts) != 4:
            raise ValueError(
                "hand must be a dotted 'S.H.D.C' holding, "
                "e.g. 'AK1064.K3.Q542.J7' (use T or 10 for ten)"
            )
        d = dict(zip(["S", "H", "D", "C"], parts))

    for suit in ("S", "H", "D", "C"):
        if suit not in d:
            raise ValueError(f"hand is missing the {suit} suit")
        for card in d[suit]:
            if card not in RANKS:
                raise ValueError(f"invalid card '{card}' in {suit}")
    total = sum(len(d[s]) for s in ("S", "H", "D", "C"))
    if total != 13:
        raise ValueError(f"hand has {total} cards, expected 13")
    return d


def hand_features(hand: dict) -> dict:
    lengths, hcp, top3, stoppers = {}, 0, {}, {}
    for suit in SUITS:
        holding = hand[SYMBOL[suit]]
        n = len(holding)
        lengths[suit] = n
        hcp += sum(HCP_VALUE.get(card, 0) for card in holding)
        top3[suit] = sum(card in ("A", "K", "Q") for card in holding)
        stoppers[suit] = (
            "A" in holding
            or ("K" in holding and n >= 2)
            or ("Q" in holding and n >= 3)
            or ("J" in holding and n >= 4)
        )
    shape = tuple(sorted(lengths.values(), reverse=True))
    return {
        "hcp": hcp,
        "lengths": lengths,
        "top3": top3,
        "stoppers": stoppers,
        "balanced": shape in BALANCED_SHAPES,
        "shape": "-".join(str(lengths[s]) for s in SUITS),
    }


def meets(conditions: dict, f: dict) -> bool:
    """True if the hand's features satisfy a rule's `conditions` block.

    Only the executable predicates live here; everything else in a rule
    (meaning, promised, ...) is descriptive and ignored.
    """
    conditions = conditions or {}

    hcp = conditions.get("hcp", {})
    if "min" in hcp and f["hcp"] < hcp["min"]:
        return False
    if "max" in hcp and f["hcp"] > hcp["max"]:
        return False

    if "balanced" in conditions and f["balanced"] != conditions["balanced"]:
        return False

    for suit, rng in conditions.get("length", {}).items():
        n = f["lengths"][suit]
        if "min" in rng and n < rng["min"]:
            return False
        if "max" in rng and n > rng["max"]:
            return False

    for cmp in conditions.get("compare", []):
        left, right = f["lengths"][cmp["left"]], f["lengths"][cmp["right"]]
        if cmp["op"] == "ge" and not left >= right:
            return False
        if cmp["op"] == "gt" and not left > right:
            return False

    if "four_card_major" in conditions:
        has = f["lengths"]["spades"] >= 4 or f["lengths"]["hearts"] >= 4
        if conditions["four_card_major"] != has:
            return False

    th = conditions.get("top3_honors")
    if th and f["top3"][th["suit"]] < th["min"]:
        return False

    si = conditions.get("stopper_in")
    if si and not f["stoppers"][si]:
        return False

    return True


# --------------------------------------------------------------------------
# Situation selection
# --------------------------------------------------------------------------
def find_situation(system: dict, auction, seat: str | None = None) -> dict:
    """Select the situation matching the auction (and seat, if needed).

    Raises LookupError if no situation matches, or if the auction is
    ambiguous and `seat` doesn't resolve it.
    """
    key = tuple(normalize_auction(auction))
    candidates = [s for s in system["situations"] if s["_auction_key"] == key]

    if not candidates:
        raise LookupError(
            f"no situation for auction {list(key)} in system '{system['id']}'"
        )
    if len(candidates) == 1:
        return candidates[0]

    if seat:
        by_seat = [s for s in candidates if s["_seat"] == seat]
        if len(by_seat) == 1:
            return by_seat[0]

    ids = [s["id"] for s in candidates]
    raise LookupError(
        f"auction {list(key)} is ambiguous; specify seat to choose among {ids}"
    )


# --------------------------------------------------------------------------
# The three consumers
# --------------------------------------------------------------------------
def decide(system: dict, auction, hand: dict, seat: str | None = None) -> dict:
    """Bot: first matching rule for the hand in the selected situation."""
    f = hand_features(hand)
    sit = find_situation(system, auction, seat)
    for rule in sit["rules"]:
        if meets(rule.get("conditions", {}), f):
            return {
                "call": rule["call"],
                "meaning": rule["meaning"],
                "promised": rule.get("promised"),
                "rule_id": rule.get("id"),
                "situation_id": sit["id"],
                "features": f,
            }
    return {
        "call": None,
        "meaning": "no rule matched",
        "promised": None,
        "rule_id": None,
        "situation_id": sit["id"],
        "features": f,
    }


def conformance(system: dict, auction, hand: dict, student_call: str,
                seat: str | None = None) -> dict:
    """Conformance: did the student make the system's prescribed call?

    First-match-wins makes exactly one call correct per hand, so the grade is
    `student_call == bot_call`. When it differs, we return the call the system
    would have made plus its meaning/promised, so the narration layer can
    explain the gap.
    """
    res = decide(system, auction, hand, seat)
    expected = res["call"]
    given = normalize_call(student_call)
    return {
        "conformant": expected is not None and given == normalize_call(expected),
        "your_call": given,
        "expected_call": expected,
        "expected_meaning": res["meaning"],
        "expected_promised": res["promised"],
        "situation_id": res["situation_id"],
        "features": res["features"],
    }


def explain_call(system: dict, auction, call: str,
                 seat: str | None = None) -> dict:
    """Questions: what does `call` mean / promise in this situation?"""
    sit = find_situation(system, auction, seat)
    target = normalize_call(call)
    for rule in sit["rules"]:
        if normalize_call(rule["call"]) == target:
            return {
                "found": True,
                "call": rule["call"],
                "meaning": rule["meaning"],
                "promised": rule.get("promised"),
                "rule_id": rule.get("id"),
                "situation_id": sit["id"],
            }
    return {
        "found": False,
        "call": target,
        "meaning": None,
        "promised": None,
        "rule_id": None,
        "situation_id": sit["id"],
    }
