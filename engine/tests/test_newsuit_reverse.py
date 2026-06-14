"""Responder after opener's new-suit-up-the-line and reverses (deferred branch).

New suit (1m-1H-1S) is NOT forcing: spade-fit raise / NT / heart rebid / 1NT.
A reverse (1m-1M-2higher) IS forcing: responder never passes — 3NT (10+) /
rebid a 5-card major / cheap preference to opener's first suit. Seat = responder.
"""
import pytest

NEW_C = ["1C", "Pass", "1H", "Pass", "1S", "Pass"]   # opener shows 4 spades
REV_CH = ["1C", "Pass", "1H", "Pass", "2D", "Pass"]  # reverse, forcing
REV_DS = ["1D", "Pass", "1S", "Pass", "2H", "Pass"]  # reverse, forcing

CASES = [
    # New suit up the line — not forcing.
    (NEW_C, "KQ32.AQ32.K32.32", "4S"),    # 14 HCP, 4 spades -> game in the fit
    (NEW_C, "Q432.K432.Q32.32", "2S"),    # 7 HCP, 4 spades -> simple raise
    (NEW_C, "32.KQ432.J32.432", "2H"),    # 6 HCP, 5 hearts, no fit -> rebid hearts
    (NEW_C, "32.K432.Q432.432", "1NT"),   # 5 HCP, no fit -> minimum 1NT
    (NEW_C, "32.AQ32.KQ32.A32", "3NT"),   # 15 HCP, no spade fit -> 3NT
    # Reverses — forcing (no Pass anywhere).
    (REV_CH, "Q32.KQ32.J32.Q32", "3NT"),  # 10 HCP -> game
    (REV_CH, "32.KQ432.J32.432", "2H"),   # 6 HCP, 5 hearts -> rebid
    (REV_CH, "32.K432.J432.432", "3C"),   # 4 HCP, no rebid -> forcing preference
    (REV_DS, "KQ432.32.J32.432", "2S"),   # 6 HCP, 5 spades -> rebid
    (REV_DS, "Q432.32.K32.J432", "3D"),   # 6 HCP, 4 spades -> preference (no 5-card major)
]


@pytest.mark.parametrize("auction,hand,expected", CASES)
def test_newsuit_and_reverse(client, auction, hand, expected):
    r = client.post("/bid", json={"hand": hand, "auction": auction, "seat": "responder"})
    assert r.status_code == 200, r.text
    assert r.json()["call"] == expected, f"{hand} after {auction}: got {r.json()['call']}"
