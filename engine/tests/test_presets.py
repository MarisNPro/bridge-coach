"""Rule-variant presets (NT-range Phase 1 mechanism).

A rule may carry a `presets` list; the bidder keeps only rules whose `presets`
is absent (apply always) or contains the active preset, before first-match.
No shipped rule is tagged yet, so natural-v1 is parity-inert under any preset.
"""
from app import bidder

HAND = "2345.2345.234.23"   # 13 cards, irrelevant to the {}-condition rules


def _synthetic():
    system = {
        "id": "syn",
        "situations": [{
            "id": "s", "when": {"seat": None, "auction": []},
            "rules": [
                {"id": "s1", "presets": ["strong"], "conditions": {}, "call": "1N", "meaning": "strong"},
                {"id": "w1", "presets": ["weak"], "conditions": {}, "call": "2N", "meaning": "weak"},
                {"id": "any", "conditions": {}, "call": "Pass", "meaning": "catch-all"},
            ],
        }],
    }
    bidder._index(system)
    return system


def test_preset_selects_the_tagged_rule():
    system = _synthetic()
    hand = bidder.parse_hand(HAND)
    assert bidder.decide(system, [], hand)["call"] == "1N"                 # default -> strong
    assert bidder.decide(system, [], hand, preset="strong")["call"] == "1N"
    assert bidder.decide(system, [], hand, preset="weak")["call"] == "2N"
    assert bidder.decide(system, [], hand, preset="mini")["call"] == "Pass"  # no tagged match -> catch-all


def test_default_preset_from_system():
    system = _synthetic()
    system["default_preset"] = "weak"
    hand = bidder.parse_hand(HAND)
    assert bidder.decide(system, [], hand)["call"] == "2N"   # system default applies when none given


# --- natural-v1 wires the weak-NT preset live (NT-range P2) ----------------
# The default preset is `strong`, so the unparameterised system is unchanged
# (see tests/test_parity.py); `weak` reframes 1NT as 12-14.
def test_natural_v1_uses_strong_and_weak_tags():
    system = bidder.load_system("natural-v1")
    tags = {p for s in system["situations"] for r in s["rules"]
            for p in r.get("presets", [])}
    assert tags == {"strong", "weak"}
    # The default preset never changes the shipped behaviour.
    assert system.get("default_preset") in (None, "strong")


def test_bid_preset_changes_1nt_opening(client):
    # 15 HCP balanced: a strong 1NT, but a one-suit opening under weak (12-14).
    base = {"hand": "AQ4.KJ3.KQ52.432", "auction": []}
    a = client.post("/bid", json=base).json()["call"]
    b = client.post("/bid", json={**base, "preset": "strong"}).json()["call"]
    c = client.post("/bid", json={**base, "preset": "weak"}).json()["call"]
    assert a == b == "1NT"
    assert c != "1NT"


def test_conformance_respects_preset(client):
    # 1NT with a 15-count is conformant only under strong/default, not weak.
    strong_hand = {"hand": "AQ4.KJ3.KQ52.432", "auction": [], "call": "1NT"}
    assert client.post("/conformance", json=strong_hand).json()["conformant"] is True
    assert client.post("/conformance", json={**strong_hand, "preset": "weak"}).json()["conformant"] is False
    # A 13-count balanced is a conformant 1NT only under weak.
    weak_hand = {"hand": "KQ32.KJ32.Q3.Q32", "auction": [], "call": "1NT"}
    assert client.post("/conformance", json={**weak_hand, "preset": "weak"}).json()["conformant"] is True
    assert client.post("/conformance", json=weak_hand).json()["conformant"] is False
