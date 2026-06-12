"""Runtime-applied toggles — the Phase 1 mechanism (resolver + override).

No shipped situation uses a toggle reference yet, so this proves the mechanism
on a synthetic in-memory system and asserts natural-v1 is unaffected (parity).
"""
import pytest

from app import bidder


def _synthetic_system():
    # One situation: bid X iff hcp is inside the (toggle-referenced) band, else Pass.
    system = {
        "id": "synthetic",
        "toggles": {"band": {"min": 6, "max": 10}},
        "situations": [{
            "id": "s", "when": {"seat": None, "auction": []},
            "rules": [
                {"id": "in", "conditions": {"hcp": {"min_ref": "band.min", "max_ref": "band.max"}},
                 "call": "X", "meaning": "in band"},
                {"id": "out", "conditions": {}, "call": "Pass", "meaning": "out"},
            ],
        }],
    }
    bidder._index(system)
    return system


# A flat 12-count: outside the default 6-10 band, inside an 11-13 override.
HAND_12 = "AKQ.K34.2345.234"


def test_ref_resolves_against_default_toggles():
    system = _synthetic_system()
    hand = bidder.parse_hand(HAND_12)
    assert bidder.hand_features(hand)["hcp"] == 12
    assert bidder.decide(system, [], hand)["call"] == "Pass"  # 12 not in 6-10


def test_override_changes_the_decision():
    system = _synthetic_system()
    hand = bidder.parse_hand(HAND_12)
    res = bidder.decide(system, [], hand, toggles={"band": {"min": 11, "max": 13}})
    assert res["call"] == "X"  # 12 now in 11-13
    # Base system toggles are not mutated by the override.
    assert system["toggles"]["band"] == {"min": 6, "max": 10}


def test_effective_toggles_deep_merges():
    system = _synthetic_system()
    eff = bidder.effective_toggles(system, {"band": {"max": 12}})
    assert eff["band"] == {"min": 6, "max": 12}      # min retained, max overridden
    assert bidder.effective_toggles(system, None)["band"]["max"] == 10


def test_resolve_refs_prefers_reference_over_literal():
    out = bidder._resolve_refs({"hcp": {"min": 99, "min_ref": "band.min"}}, {"band": {"min": 6}})
    assert out["hcp"]["min"] == 6 and "min_ref" not in out["hcp"]


def test_missing_toggle_path_raises():
    with pytest.raises(LookupError):
        bidder._resolve_refs({"hcp": {"min_ref": "nope.min"}}, {"band": {"min": 6}})


@pytest.mark.parametrize("bad", [
    {"weak2_range": {"min": "x"}},      # non-integer bound
    {"weak2_range": {"min": 11, "max": 5}},  # min > max
    [1, 2, 3],                           # not an object
])
def test_validate_rejects_bad_overrides(bad):
    with pytest.raises(ValueError):
        bidder.validate_toggles_override(bad)


def test_validate_accepts_good_overrides():
    bidder.validate_toggles_override(None)
    bidder.validate_toggles_override({"open_min_hcp": 11, "weak2_range": {"min": 5, "max": 11}})


# --- the shipped system is unaffected (inert / parity) --------------------
def test_natural_v1_has_no_toggle_refs():
    system = bidder.load_system("natural-v1")
    assert not any(bidder._has_refs(r.get("conditions", {}))
                   for s in system["situations"] for r in s["rules"])


def test_bid_with_toggles_override_is_inert_for_natural_v1(client):
    base = {"hand": "AQ4.KJ3.KQ52.432", "auction": []}            # opens 1NT
    a = client.post("/bid", json=base).json()["call"]
    b = client.post("/bid", json={**base, "toggles": {"weak2_range": {"min": 5, "max": 11}}}).json()["call"]
    assert a == b == "1NT"   # override changes nothing (no rule references it yet)


def test_bid_rejects_invalid_toggles_422(client):
    r = client.post("/bid", json={"hand": "AQ4.KJ3.KQ52.432", "auction": [], "toggles": {"weak2_range": {"min": 11, "max": 5}}})
    assert r.status_code == 422
