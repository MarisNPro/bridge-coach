"""/conformance — grade a student's call against the system.

Grading is "first matching rule wins", so exactly one call is correct per
hand. These cover both verdicts and the loose-input normalization the UI
relies on (it submits whatever the bidding box produced).
"""
OPEN_1NT_HAND = "AQ4.KJ3.KQ52.432"  # system opens this 1NT


def test_conformance_correct_call(client):
    r = client.post("/conformance", json={"hand": OPEN_1NT_HAND, "auction": [], "call": "1NT"})
    assert r.status_code == 200
    body = r.json()
    assert body["conformant"] is True
    assert body["your_call"] == "1NT"
    assert body["expected_call"] == "1NT"
    assert body["expected_meaning"]


def test_conformance_incorrect_returns_expected(client):
    # 1C is wrong for a 15-balanced hand; the grader must hand back the
    # system's call + meaning so the UI can teach the gap (story B5).
    r = client.post("/conformance", json={"hand": OPEN_1NT_HAND, "auction": [], "call": "1C"})
    assert r.status_code == 200
    body = r.json()
    assert body["conformant"] is False
    assert body["your_call"] == "1C"
    assert body["expected_call"] == "1NT"
    assert body["expected_meaning"]


def test_conformance_normalizes_loose_call(client):
    # The bidding box / a human may send 'pass', '1nt', 'dbl'; the engine
    # canonicalizes both sides before comparing, so '1nt' still grades correct.
    r = client.post("/conformance", json={"hand": OPEN_1NT_HAND, "auction": [], "call": "1nt"})
    assert r.status_code == 200
    body = r.json()
    assert body["conformant"] is True
    assert body["your_call"] == "1NT"  # echoed back canonicalized


def test_conformance_malformed_hand_422(client):
    r = client.post("/conformance", json={"hand": "garbage", "auction": [], "call": "1NT"})
    assert r.status_code == 422
