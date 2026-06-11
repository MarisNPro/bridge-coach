"""Competitive limit raise in the negative-double situations.

Each major-support resp-*-over situation gains an invitational jump raise
(10-11 with 3+ support) that fills the band between the 6-9 simple raise and
the 12+ cue. The new rule sits just before the Pass catch-all, so it only
captures hands that previously had no call — the curated 6-9 / 11-12-NT / 12+
bands must still resolve exactly as before (regression pins below).
"""
import pytest


# New invitational tier: 10 HCP with 4 trumps, no NT-qualifying stopper, and not
# enough for the 6-9 simple raise nor the 12+ cue. (These previously passed.)
INVITE_CASES = [
    (["1H", "(1S)"], "543.KQ32.K432.Q3", "3H"),    # 10 HCP, 4 hearts, no spade stopper
    (["1H", "(2C)"], "543.KQ32.K432.Q3", "3H"),    # 10 HCP, 4 hearts
    (["1H", "(2D)"], "543.KQ32.K432.Q3", "3H"),    # 10 HCP, 4 hearts
    (["1S", "(2C)"], "KQ32.543.K432.Q3", "3S"),    # 10 HCP, 4 spades
    (["1S", "(2D)"], "KQ32.543.K432.Q3", "3S"),    # 10 HCP, 4 spades
    (["1S", "(2H)"], "KQ32.543.K432.Q3", "3S"),    # 10 HCP, 4 spades
]


@pytest.mark.parametrize("auction,hand,expected", INVITE_CASES)
def test_competitive_limit_raise(client, auction, hand, expected):
    r = client.post("/bid", json={"hand": hand, "auction": auction, "seat": "responder"})
    assert r.status_code == 200, r.text
    assert r.json()["call"] == expected, f"{hand} after {auction}: got {r.json()['call']}"


# Regression: the existing bands are unchanged by the new rule.
REGRESSION_CASES = [
    (["1H", "(2C)"], "KQ32.A32.432.432", "X"),     # 9 HCP, 4 spades -> negative double
    (["1H", "(2C)"], "AQ2.AK32.A32.432", "3C"),    # 17 HCP -> cue (game force)
    (["1H", "(2C)"], "A432.K32.432.432", "2H"),    # 7 HCP, 3 hearts -> simple raise
    (["1S", "(2H)"], "K432.43.KJ32.432", "2S"),    # 7 HCP, 4 spades -> simple raise
]


@pytest.mark.parametrize("auction,hand,expected", REGRESSION_CASES)
def test_existing_bands_unchanged(client, auction, hand, expected):
    r = client.post("/bid", json={"hand": hand, "auction": auction, "seat": "responder"})
    assert r.status_code == 200, r.text
    assert r.json()["call"] == expected, f"{hand} after {auction}: got {r.json()['call']}"
