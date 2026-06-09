"""/bid — the system bot at the HTTP boundary.

Parity (tests/test_parity.py) already proves the bidder reproduces the 85
signed-off cases; these tests cover the router contract on top of it:
status codes, response shape, and the dotted-hand parsing the routes rely on.
"""
# A flat 15-count, 4-3-3-3-ish balanced hand: the system opens this 1NT.
OPEN_1NT_HAND = "AQ4.KJ3.KQ52.432"


def test_bid_opening_1nt(client):
    r = client.post("/bid", json={"hand": OPEN_1NT_HAND, "auction": []})
    assert r.status_code == 200
    body = r.json()
    assert body["call"] == "1NT"
    assert body["situation_id"] == "opening"
    assert body["meaning"]  # non-empty narration drawn from the data
    assert body["promised"] is not None


def test_bid_defaults_system_and_auction(client):
    # auction + system_id are optional; omitting them means "opening, natural-v1".
    r = client.post("/bid", json={"hand": OPEN_1NT_HAND})
    assert r.status_code == 200
    assert r.json()["situation_id"] == "opening"


def test_bid_unknown_system_404(client):
    r = client.post("/bid", json={"hand": OPEN_1NT_HAND, "system_id": "no-such-system"})
    assert r.status_code == 404
    assert "no-such-system" in r.json()["detail"]
