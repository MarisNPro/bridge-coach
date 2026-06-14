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

import copy
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
        "aces": sum(1 for s in SUITS if "A" in hand[SYMBOL[s]]),
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

    ac = conditions.get("aces")
    if ac:
        if "min" in ac and f["aces"] < ac["min"]:
            return False
        if "max" in ac and f["aces"] > ac["max"]:
            return False

    return True


# --------------------------------------------------------------------------
# Toggles (runtime-applied, Phase 1 — inert until a rule uses a `*_ref`)
# --------------------------------------------------------------------------
# A rule condition bound may reference a toggle instead of a literal, e.g.
#   hcp: { min_ref: weak2_range.min, max_ref: weak2_range.max }
# The effective toggles (system defaults deep-merged with an optional per-request
# override) resolve the reference to a number before `meets()` runs. No system
# file uses refs yet, so this changes nothing for natural-v1 — decide() only
# resolves a rule that actually carries a `*_ref` (see `_has_refs`).
def validate_toggles_override(override) -> None:
    """Light shape check for a request's toggle override. Raises ValueError."""
    if override is None:
        return
    if not isinstance(override, dict):
        raise ValueError("toggles must be an object")
    for key, val in override.items():
        if isinstance(val, (bool, int)):
            continue
        if isinstance(val, dict):
            lo, hi = val.get("min"), val.get("max")
            for b in (lo, hi):
                if b is not None and (isinstance(b, bool) or not isinstance(b, int)):
                    raise ValueError(f"toggle '{key}' bounds must be integers")
            if isinstance(lo, int) and isinstance(hi, int) and lo > hi:
                raise ValueError(f"toggle '{key}': min {lo} > max {hi}")
            continue
        raise ValueError(f"toggle '{key}' has an unsupported value")


def effective_toggles(system: dict, override=None) -> dict:
    """System toggles with an override deep-merged over them (one level deep,
    which matches the flat scalar / {min,max} toggle shapes)."""
    base = system.get("toggles", {}) or {}
    if not override:
        return base
    merged = copy.deepcopy(base)
    for k, v in override.items():
        if isinstance(v, dict) and isinstance(merged.get(k), dict):
            merged[k] = {**merged[k], **v}
        else:
            merged[k] = v
    return merged


def _toggle_value(toggles: dict, path: str):
    node = toggles
    for part in path.split("."):
        if not isinstance(node, dict) or part not in node:
            raise LookupError(f"toggle path '{path}' not found")
        node = node[part]
    return node


def _has_refs(node) -> bool:
    if isinstance(node, dict):
        return any(k.endswith("_ref") or _has_refs(v) for k, v in node.items())
    if isinstance(node, list):
        return any(_has_refs(x) for x in node)
    return False


def _resolve_refs(node, toggles: dict):
    """Return a copy of `node` with every `<x>_ref: "a.b"` replaced by `<x>:
    <toggles.a.b>`. References win over any literal sibling."""
    if isinstance(node, dict):
        out = {k: _resolve_refs(v, toggles) for k, v in node.items() if not k.endswith("_ref")}
        for k, v in node.items():
            if k.endswith("_ref") and isinstance(v, str):
                out[k[:-4]] = _toggle_value(toggles, v)
        return out
    if isinstance(node, list):
        return [_resolve_refs(x, toggles) for x in node]
    return node


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
def active_preset(system: dict, preset) -> str:
    """The active rule-variant preset (e.g. the NT range). Untagged rules apply
    to every preset, so this only selects among rules that carry a `presets`
    list; defaults to the system's default (or 'strong')."""
    return preset or system.get("default_preset") or "strong"


def _preset_ok(rule: dict, preset: str) -> bool:
    ps = rule.get("presets")
    return ps is None or preset in ps


def decide(system: dict, auction, hand: dict, seat: str | None = None,
           toggles=None, preset=None) -> dict:
    """Bot: first matching rule for the hand in the selected situation.

    `toggles` is an optional per-request override of the system's toggles; it
    only affects rules whose conditions reference a toggle (`*_ref`). `preset`
    selects rule variants tagged with a `presets` list (e.g. the 1NT range);
    untagged rules apply to every preset. With no `*_ref` and no `presets` tags
    (today's natural-v1) neither override changes anything.
    """
    f = hand_features(hand)
    sit = find_situation(system, auction, seat)
    pre = active_preset(system, preset)
    eff = None
    for rule in sit["rules"]:
        if not _preset_ok(rule, pre):
            continue
        conds = rule.get("conditions", {})
        if _has_refs(conds):
            if eff is None:
                eff = effective_toggles(system, toggles)
            conds = _resolve_refs(conds, eff)
        if meets(conds, f):
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
                seat: str | None = None, toggles=None, preset=None) -> dict:
    """Conformance: did the student make the system's prescribed call?

    First-match-wins makes exactly one call correct per hand, so the grade is
    `student_call == bot_call`. When it differs, we return the call the system
    would have made plus its meaning/promised, so the narration layer can
    explain the gap.
    """
    res = decide(system, auction, hand, seat, toggles=toggles, preset=preset)
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
    # A call can appear in several rules (e.g. Michaels 2H over 1H has weak/strong
    # variants, or two two-suiter shapes). Return them all so questions can show
    # every meaning the call carries, not just the first.
    matches = [r for r in sit["rules"] if normalize_call(r["call"]) == target]
    if matches:
        first = matches[0]
        return {
            "found": True,
            "call": first["call"],
            "meaning": first["meaning"],
            "promised": first.get("promised"),
            "rule_id": first.get("id"),
            "situation_id": sit["id"],
            "variants": [
                {"meaning": r["meaning"], "promised": r.get("promised"), "rule_id": r.get("id")}
                for r in matches
            ],
        }
    return {
        "found": False,
        "call": target,
        "meaning": None,
        "promised": None,
        "rule_id": None,
        "situation_id": sit["id"],
        "variants": [],
    }
