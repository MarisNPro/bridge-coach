"""Advancing partner's simple 1-level major overcall.

The advancer framework is uniform across the four (1m/lower)–(1M)–(Pass)
situations: cue-bid of opener's suit = 10+ forcing raise; jump = pre-emptive
(4+ support); simple raise = 6-9 with 3+ support; otherwise pass. These cases
pin one representative call in each band so the YAML can't silently drift.
"""
import pytest

# (auction, dotted hand, expected call) — seat is always the advancer.
CASES = [
    # advance-1c-overcall-1h
    (["(1C)", "1H", "(Pass)"], "K43.Q432.765.872", "3H"),   # 5 HCP, 4 hearts -> pre-empt
    (["(1C)", "1H", "(Pass)"], "AQ2.K32.K32.5432", "2C"),   # 12 HCP, 3 hearts -> cue
    # advance-1d-overcall-1h
    (["(1D)", "1H", "(Pass)"], "Q32.K32.Q32.5432", "2H"),   # 7 HCP, 3 hearts -> simple raise
    # advance-1c-overcall-1s
    (["(1C)", "1S", "(Pass)"], "Q432.765.872.K43", "3S"),   # 5 HCP, 4 spades -> pre-empt
    # advance-1d-overcall-1s
    (["(1D)", "1S", "(Pass)"], "K32.A32.Q32.Q432", "2D"),   # 11 HCP, 3 spades -> cue
    (["(1D)", "1S", "(Pass)"], "32.J432.765.8732", "Pass"), # 1 HCP, 2 spades -> too weak
]


@pytest.mark.parametrize("auction,hand,expected", CASES)
def test_advance_overcall(client, auction, hand, expected):
    r = client.post("/bid", json={"hand": hand, "auction": auction, "seat": "advancer"})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["call"] == expected, f"{hand} after {auction}: got {body['call']}"
    assert body["meaning"]
