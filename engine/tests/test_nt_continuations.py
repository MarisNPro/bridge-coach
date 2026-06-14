"""Responder's placement after a 1NT auction (PR-A: 1NT continuations).

Opener is 15-17. After Stayman a 4-4 major fit invites (3M) or bids game (4M),
no fit goes to notrump; after a transfer 6+ trumps invite/bid game, exactly 5
offers a choice. Seat is always the responder.
"""
import pytest

STAYMAN_2D = ["1NT", "Pass", "2C", "Pass", "2D", "Pass"]
STAYMAN_2H = ["1NT", "Pass", "2C", "Pass", "2H", "Pass"]
TRANSFER_H = ["1NT", "Pass", "2D", "Pass", "2H", "Pass"]

CASES = [
    # After Stayman, no major (2D): notrump placement.
    (STAYMAN_2D, "AQ2.KJ2.Q432.432", "3NT"),  # 12 HCP -> game
    (STAYMAN_2D, "Q32.KJ2.Q432.432", "2NT"),  # 8 HCP -> invite
    # After Stayman, opener has 4 hearts (2H).
    (STAYMAN_2H, "32.KQ32.AQ32.432", "4H"),   # 11 HCP, 4 hearts -> game in the fit
    (STAYMAN_2H, "432.KQ32.Q43.Q32", "3H"),   # 9 HCP, 4 hearts -> invite
    (STAYMAN_2H, "AQ2.32.KQ32.Q432", "3NT"),  # 13 HCP, no heart fit -> 3NT
    # After a transfer to hearts (responder shows 5+ hearts).
    (TRANSFER_H, "2.KQJ432.A32.432", "4H"),   # 10 HCP, 6 hearts -> game
    (TRANSFER_H, "A2.KQ432.A32.432", "3NT"),  # 13 HCP, exactly 5 -> choice (3NT)
    (TRANSFER_H, "32.KQ432.K32.432", "2NT"),  # 8 HCP, 5 hearts -> invite
    (TRANSFER_H, "32.KQ432.432.432", "Pass"), # 5 HCP, 5 hearts -> pass the transfer
]


@pytest.mark.parametrize("auction,hand,expected", CASES)
def test_nt_continuation(client, auction, hand, expected):
    r = client.post("/bid", json={"hand": hand, "auction": auction, "seat": "responder"})
    assert r.status_code == 200, r.text
    assert r.json()["call"] == expected, f"{hand} after {auction}: got {r.json()['call']}"
