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


# --- natural-v1 is untagged -> preset is inert (parity) -------------------
def test_natural_v1_has_no_preset_tags():
    system = bidder.load_system("natural-v1")
    assert not any("presets" in r for s in system["situations"] for r in s["rules"])


def test_bid_preset_is_inert_for_natural_v1(client):
    base = {"hand": "AQ4.KJ3.KQ52.432", "auction": []}   # opens 1NT
    a = client.post("/bid", json=base).json()["call"]
    b = client.post("/bid", json={**base, "preset": "weak"}).json()["call"]
    assert a == b == "1NT"


def test_conformance_accepts_preset(client):
    r = client.post("/conformance", json={"hand": "AQ4.KJ3.KQ52.432", "auction": [], "call": "1NT", "preset": "weak"})
    assert r.status_code == 200
    assert r.json()["conformant"] is True
