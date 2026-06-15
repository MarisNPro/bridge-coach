"""/explain — what a call means / promises in a given auction.

Narration only: meaning comes straight from the data. A defined call returns
its meaning; an undefined call is flagged rather than erroring. /explain takes
no hand, so the only inputs are auction + call (+ seat to disambiguate).
"""


def test_explain_defined_call(client):
    r = client.post("/explain", json={"auction": [], "call": "1NT"})
    assert r.status_code == 200
    body = r.json()
    assert body["situation_id"] == "opening"
    assert body["meaning"]
    assert body["text"].startswith("1NT:")  # "{call}: {meaning}"
    # The 1NT opening carries two preset variants (strong 15-17 / weak 12-14).
    metas = [v["meaning"] for v in body["variants"]]
    assert any("15-17" in m for m in metas)


def test_explain_enumerates_variants_for_a_reused_call(client):
    # Over a 1H opening, 2H is Michaels with several encoded variants; /explain
    # should return all their meanings, not just the first.
    r = client.post("/explain", json={"auction": ["(1H)"], "call": "2H", "seat": "overcaller"})
    assert r.status_code == 200
    body = r.json()
    assert len(body["variants"]) >= 2
    assert all(v["meaning"] for v in body["variants"])


def test_explain_undefined_call_is_flagged_not_an_error(client):
    # 7NT isn't a defined opening call; the engine says so instead of 4xx.
    r = client.post("/explain", json={"auction": [], "call": "7NT"})
    assert r.status_code == 200
    body = r.json()
    assert body["meaning"] is None
    assert "not a defined call" in body["text"]


def test_explain_ambiguous_auction_requires_seat(client):
    # ["1C","(1S)"] is used by two seats (opener vs responder); without `seat`
    # the situation is unselectable -> 422.
    r = client.post("/explain", json={"auction": ["1C", "(1S)"], "call": "Pass"})
    assert r.status_code == 422
    assert "ambiguous" in r.json()["detail"]


def test_explain_seat_disambiguates(client):
    r = client.post("/explain", json={"auction": ["1C", "(1S)"], "call": "Pass", "seat": "opener"})
    assert r.status_code == 200
    assert r.json()["situation_id"] == "opener-after-1c-1s"
