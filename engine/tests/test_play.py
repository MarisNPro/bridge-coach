"""/play — double-dummy play oracle at the HTTP boundary.

Skipped if endplay isn't installed. Uses one fixed deal; declarer S in 3NT, so
the opening leader is West (declarer's LHO).
"""
import pytest

pytest.importorskip("endplay")

DEAL = "N:AJT8.T9.972.A853 K75.AJ53.QJ83.J4 964.K8.AKT5.Q962 Q32.Q7642.64.KT7"


def _play(client, played, strain="NT", declarer="S"):
    return client.post("/play", json={"deal": DEAL, "strain": strain, "declarer": declarer, "played": played})


def test_play_opening_lead(client):
    r = _play(client, [])
    assert r.status_code == 200
    b = r.json()
    assert b["to_act"] == "W"          # declarer S's left-hand opponent
    assert b["complete"] is False
    assert b["trick"] == []
    assert len(b["legal"]) == 13       # 13 legal opening leads
    assert (b["declarer_tricks"], b["defender_tricks"]) == (0, 0)


def test_play_first_trick_advances_and_counts(client):
    played = []
    seats = []
    for _ in range(4):
        b = _play(client, played).json()
        seats.append(b["to_act"])
        played.append(b["legal"][0]["card"])
    after = _play(client, played).json()
    assert seats == ["W", "N", "E", "S"]        # clockwise from the opening leader
    assert after["trick"] == []                  # trick resolved
    assert after["declarer_tricks"] + after["defender_tricks"] == 1


def test_play_full_deal_makes_thirteen_tricks(client):
    played = []
    for _ in range(52):
        b = _play(client, played).json()
        assert b["complete"] is False
        played.append(b["legal"][0]["card"])
    done = _play(client, played).json()
    assert done["complete"] is True
    assert done["legal"] == []
    assert done["declarer_tricks"] + done["defender_tricks"] == 13


def test_play_illegal_card_422(client):
    r = _play(client, ["SA"])   # West holds no ace of spades
    assert r.status_code == 422


def test_play_invalid_contract_422(client):
    assert _play(client, [], strain="ZZ").status_code == 422
    assert _play(client, [], declarer="Q").status_code == 422
