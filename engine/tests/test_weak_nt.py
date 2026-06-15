"""Weak-NT preset (NT-range P2, slice 1).

The `weak` preset reframes 1NT as a 12-14 opening. The opening band and the
responder's invite/game thresholds shift; transfers stay point-agnostic. The
default preset is `strong` (15-17), so these are pure additions — parity with
the unparameterised system is covered by tests/test_parity.py.
"""
import pytest

from app import bidder  # noqa: F401  (ensures the app package imports cleanly)

OPEN = []
RESP = ["1NT", "Pass"]  # seat: responder


def _bid(client, hand, auction, seat, preset=None):
    body = {"hand": hand, "auction": auction, "seat": seat}
    if preset is not None:
        body["preset"] = preset
    r = client.post("/bid", json=body)
    assert r.status_code == 200, r.text
    return r.json()["call"]


def test_weak_nt_opening(client):
    """A 12-14 balanced hand opens 1NT only under the weak preset."""
    h = "KQ32.KJ32.Q3.Q32"  # 13 HCP, 4-4-2-3 balanced, no 5-card major
    assert _bid(client, h, OPEN, "opener", "weak") == "1NT"
    assert _bid(client, h, OPEN, "opener") != "1NT"           # default (strong): opens a suit
    assert _bid(client, h, OPEN, "opener", "strong") != "1NT"


def test_strong_nt_opening(client):
    """A 15-17 balanced hand opens 1NT only under strong/default; a suit under weak."""
    h = "AK32.AJ32.Q3.Q32"  # 16 HCP, 4-4-2-3 balanced
    assert _bid(client, h, OPEN, "opener") == "1NT"
    assert _bid(client, h, OPEN, "opener", "strong") == "1NT"
    assert _bid(client, h, OPEN, "opener", "weak") != "1NT"


@pytest.mark.parametrize("hand,strong_call,weak_call", [
    ("Q32.QJ3.KQ2.5432", "3NT", "Pass"),  # 10 HCP bal: game vs 15-17, pass vs 12-14
    ("Q32.KJ3.KQ2.5432", "3NT", "2NT"),   # 11 HCP bal: game vs 15-17, invite vs 12-14
    ("Q32.KJ3.KQ32.J32", "3NT", "2NT"),   # 12 HCP bal: game vs 15-17, invite vs 12-14
])
def test_responder_thresholds(client, hand, strong_call, weak_call):
    """Responder's invite/game line shifts up ~3 HCP opposite a weak 1NT."""
    assert _bid(client, hand, RESP, "responder") == strong_call  # default = strong
    assert _bid(client, hand, RESP, "responder", "weak") == weak_call


def test_transfer_preset_agnostic(client):
    """Jacoby transfers carry no points, so they apply under both presets."""
    h = "Q32.KJ987.Q3.Q32"  # 5 hearts
    assert _bid(client, h, RESP, "responder") == "2D"
    assert _bid(client, h, RESP, "responder", "weak") == "2D"
