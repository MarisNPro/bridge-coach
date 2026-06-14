"""Responder's reply to opener's game try after a major raise (PR-C, 1M-2M-3M).

Responder raised with 6-9; opener's 3M invited. Accept (4M) with a maximum
(8-9), else pass. Seat = responder.
"""
import pytest

H = ["1H", "Pass", "2H", "Pass", "3H", "Pass"]
S = ["1S", "Pass", "2S", "Pass", "3S", "Pass"]

CASES = [
    (H, "K32.Q32.K432.432", "4H"),    # 8 HCP -> accept
    (H, "J32.Q32.K432.432", "Pass"),  # 6 HCP -> decline
    (S, "Q32.K32.K432.432", "4S"),    # 8 HCP -> accept
    (S, "J32.Q32.Q432.432", "Pass"),  # 5 HCP -> decline
]


@pytest.mark.parametrize("auction,hand,expected", CASES)
def test_gametry_reply(client, auction, hand, expected):
    r = client.post("/bid", json={"hand": hand, "auction": auction, "seat": "responder"})
    assert r.status_code == 200, r.text
    assert r.json()["call"] == expected, f"{hand} after {auction}: got {r.json()['call']}"
