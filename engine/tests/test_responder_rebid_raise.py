"""Responder's rebid after opener raises the major (PR-D, 1m-1M-2M).

Opener showed 12-15 + 4 trumps (8-card fit). Responder: game (4M, 12+) /
invite (3M, 10-11) / pass (6-9). Seat = responder.
"""
import pytest

C1H = ["1C", "Pass", "1H", "Pass", "2H", "Pass"]
D1H = ["1D", "Pass", "1H", "Pass", "2H", "Pass"]
C1S = ["1C", "Pass", "1S", "Pass", "2S", "Pass"]

CASES = [
    (C1H, "K32.KQ32.KQ32.32", "4H"),    # 13 HCP -> game
    (C1H, "K32.KQ32.Q432.32", "3H"),    # 10 HCP -> invite
    (C1H, "Q32.KQ32.432.432", "Pass"),  # 7 HCP -> partscore
    (D1H, "K32.KQ32.Q432.32", "3H"),    # invite over a 1D opening
    (C1S, "KQ32.K32.KQ32.32", "4S"),    # 13 HCP -> game
    (C1S, "KQ32.K32.Q432.32", "3S"),    # 10 HCP -> invite
]


@pytest.mark.parametrize("auction,hand,expected", CASES)
def test_responder_rebid_after_raise(client, auction, hand, expected):
    r = client.post("/bid", json={"hand": hand, "auction": auction, "seat": "responder"})
    assert r.status_code == 200, r.text
    assert r.json()["call"] == expected, f"{hand} after {auction}: got {r.json()['call']}"
