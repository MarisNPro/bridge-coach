"""Slam replies (PR-E): Blackwood ace-showing + quantitative-4NT acceptance.

Also exercises the new `aces` feature/condition.
"""
import pytest

from app import bidder

BW = ["1S", "Pass", "3S", "Pass", "4NT", "Pass"]   # partner answers (seat opener)
QUANT = ["1NT", "Pass", "4NT", "Pass"]              # opener replies (seat opener)


def test_aces_feature_counts_aces():
    assert bidder.hand_features(bidder.parse_hand("A234.A234.A23.A2"))["aces"] == 4
    assert bidder.hand_features(bidder.parse_hand("K234.A234.Q23.J2"))["aces"] == 1


# Blackwood: 5C = 0/4, 5D = 1, 5H = 2, 5S = 3 aces. (Hands are 13 cards.)
BW_CASES = [
    ("AKQ2.A234.A23.A2", "5C"),   # 4 aces -> 5C
    ("AKQ2.K234.Q23.J2", "5D"),   # 1 ace  -> 5D
    ("AKQ2.A234.Q23.J2", "5H"),   # 2 aces -> 5H
    ("AKQ2.A234.A23.J2", "5S"),   # 3 aces -> 5S
    ("KQJ2.K234.Q23.J2", "5C"),   # 0 aces -> 5C
]


@pytest.mark.parametrize("hand,expected", BW_CASES)
def test_blackwood_response(client, hand, expected):
    r = client.post("/bid", json={"hand": hand, "auction": BW, "seat": "opener"})
    assert r.status_code == 200, r.text
    assert r.json()["call"] == expected, f"{hand}: got {r.json()['call']}"


@pytest.mark.parametrize("hand,expected", [
    ("AQ2.KJ3.KQ52.AJ2", "6NT"),   # 17 -> accept
    ("AQ2.KJ3.KQ52.432", "Pass"),  # 15 -> decline
])
def test_quantitative_4nt_reply(client, hand, expected):
    r = client.post("/bid", json={"hand": hand, "auction": QUANT, "seat": "opener"})
    assert r.status_code == 200, r.text
    assert r.json()["call"] == expected, f"{hand}: got {r.json()['call']}"
