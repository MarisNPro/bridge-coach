"""Error boundary + service smoke.

The hand parser is the engine's main input gate; the UI surfaces these 422
details verbatim (story B10). Also pins the documented status-code contract:
malformed hand / unselectable auction -> 422, unknown system -> 404, and the
two stub/health endpoints.
"""
import pytest

GOOD_HAND = "AQ4.KJ3.KQ52.432"


@pytest.mark.parametrize("hand", [
    "AK1064.K3.Q542",       # only three suits
    "AQ4.KJ3.KQ52.32",      # 12 cards
    "AQX.KJ3.KQ52.432",     # invalid rank 'X'
    "garbage",              # not dotted at all
])
def test_malformed_hand_422(client, hand):
    r = client.post("/bid", json={"hand": hand})
    assert r.status_code == 422
    assert r.json()["detail"]  # a human-readable reason, surfaced by the UI


def test_ten_accepts_both_T_and_10(client):
    # 'T' and '10' are the same ten; both must parse to the same opening call.
    r_t = client.post("/bid", json={"hand": "AKT64.K3.Q542.J7"})
    r_10 = client.post("/bid", json={"hand": "AK1064.K3.Q542.J7"})
    assert r_t.status_code == r_10.status_code == 200
    assert r_t.json()["call"] == r_10.json()["call"]


def test_no_situation_for_auction_422(client):
    # An auction the system data doesn't model is unselectable -> 422.
    r = client.post("/bid", json={"hand": GOOD_HAND, "auction": ["1C", "1D", "1H", "1S", "2C", "2D"]})
    assert r.status_code == 422
    assert "no situation" in r.json()["detail"]


def test_unknown_system_404_on_explain(client):
    r = client.post("/explain", json={"auction": [], "call": "1NT", "system_id": "nope"})
    assert r.status_code == 404


def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok", "phase": 1}


def test_assess_still_stubbed_501(client):
    r = client.post("/assess", json={"deal": "", "final_auction": []})
    assert r.status_code == 501
