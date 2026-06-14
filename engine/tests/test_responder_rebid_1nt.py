"""Responder's rebid after opener's 1NT rebid (PR-B, 1m-1M-1NT).

Opener is balanced 12-14. Responder places it: weak major signoff (2M, 5+),
invite (3M with 6+ / 2NT), or game (4M with 6+ / 3NT). Seat = responder.
"""
import pytest

C1H = ["1C", "Pass", "1H", "Pass", "1NT", "Pass"]
D1H = ["1D", "Pass", "1H", "Pass", "1NT", "Pass"]
C1S = ["1C", "Pass", "1S", "Pass", "1NT", "Pass"]

CASES = [
    (C1H, "2.AKQ432.KJ2.432", "4H"),     # 13 HCP, 6 hearts -> game
    (C1H, "AQ2.AQ32.J32.432", "3NT"),    # 13 HCP, 4 hearts -> 3NT
    (C1H, "2.AQJ432.KQ2.432", "3H"),     # 12 HCP, 6 hearts -> invite
    (C1H, "AQ2.KJ32.Q32.432", "2NT"),    # 12 HCP, 4 hearts -> invite NT
    (C1H, "32.KQ432.J32.432", "2H"),     # 6 HCP, 5 hearts -> weak signoff
    (C1H, "32.K432.J432.432", "Pass"),   # 4 HCP, 4 hearts -> pass 1NT
    (D1H, "AQ2.AQ32.J32.432", "3NT"),    # same ladder over a 1D opening
    (C1S, "AKQ432.2.KJ2.432", "4S"),     # 13 HCP, 6 spades -> game
    (C1S, "KQ432.32.J32.432", "2S"),     # 6 HCP, 5 spades -> weak signoff
]


@pytest.mark.parametrize("auction,hand,expected", CASES)
def test_responder_rebid_after_1nt(client, auction, hand, expected):
    r = client.post("/bid", json={"hand": hand, "auction": auction, "seat": "responder"})
    assert r.status_code == 200, r.text
    assert r.json()["call"] == expected, f"{hand} after {auction}: got {r.json()['call']}"
