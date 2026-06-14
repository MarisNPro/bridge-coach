"""Responder's rebid after opener's minimum minor rebid (PR-D-leftovers, 1m-1M-2m).

Opener showed a minimum with the minor (no support, not a 15-17 NT, no extras).
Responder: game (4M w/ 6+ / 3NT) / invite (3M w/ 6+ / 2NT) / weak major signoff
(2M w/ 6+) / pass. Seat = responder.
"""
import pytest

C1H = ["1C", "Pass", "1H", "Pass", "2C", "Pass"]
D1H = ["1D", "Pass", "1H", "Pass", "2D", "Pass"]
D1S = ["1D", "Pass", "1S", "Pass", "2D", "Pass"]

CASES = [
    (C1H, "2.AKQ432.KJ2.432", "4H"),     # 13 HCP, 6 hearts -> game
    (C1H, "AQ2.AQ32.J32.432", "3NT"),    # 13 HCP, 4 hearts -> 3NT
    (C1H, "2.AQJ432.KQ2.432", "3H"),     # 12 HCP, 6 hearts -> invite
    (C1H, "AQ2.KJ32.Q32.432", "2NT"),    # 12 HCP, 4 hearts -> invite NT
    (C1H, "32.KQJ432.J32.32", "2H"),     # 7 HCP, 6 hearts -> weak signoff
    (C1H, "32.K432.J432.432", "Pass"),   # 4 HCP -> pass the partscore
    (D1H, "2.AQJ432.KQ2.432", "3H"),     # invite over a 1D opening / 2D rebid
    (D1S, "KQJ432.32.J32.32", "2S"),     # 7 HCP, 6 spades -> weak signoff
]


@pytest.mark.parametrize("auction,hand,expected", CASES)
def test_responder_rebid_after_minor(client, auction, hand, expected):
    r = client.post("/bid", json={"hand": hand, "auction": auction, "seat": "responder"})
    assert r.status_code == 200, r.text
    assert r.json()["call"] == expected, f"{hand} after {auction}: got {r.json()['call']}"
