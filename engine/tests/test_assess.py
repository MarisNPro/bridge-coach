"""/assess — double-dummy assessment at the HTTP boundary.

Skipped if the DDS library (endplay) isn't installed, so the rest of the suite
stays independent of the native solver. Uses one fixed deal whose double-dummy
results are known: N makes 9 tricks in spades/hearts/notrump, 10 in diamonds,
8 in clubs; E/W make far fewer. Par is 3NT by N/S.
"""
import pytest

pytest.importorskip("endplay")

# N E S W, clockwise. (Fixed; DD results asserted below are stable.)
DEAL = "N:J843.A85.AQJ84.2 KQ9.T963.97.T965 752.KJ72.K5.AQJ4 AT6.Q4.T632.K873"


def _assess(client, auction, dealer="N", vul="none"):
    r = client.post("/assess", json={"deal": DEAL, "final_auction": auction,
                                     "dealer": dealer, "vul": vul})
    return r


def test_assess_making_contract(client):
    r = _assess(client, ["1NT", "Pass", "Pass", "Pass"])
    assert r.status_code == 200
    b = r.json()
    assert b["contract"] == "1NT"
    assert b["declarer"] == "N"
    assert b["tricks_made"] == 9
    assert b["result"] == 2
    assert b["makes"] is True
    assert b["conformance"] is True


def test_assess_failing_contract(client):
    # 4S needs 10 tricks; N makes only 9 double-dummy -> down one, non-conformant.
    r = _assess(client, ["4S", "Pass", "Pass", "Pass"])
    b = r.json()
    assert (b["contract"], b["tricks_made"], b["result"], b["makes"]) == ("4S", 9, -1, False)
    assert b["conformance"] is False


def test_assess_declarer_is_first_to_name_strain(client):
    # N opens 1S, S raises, N bids game: declarer is N (first NS spade bidder).
    r = _assess(client, ["1S", "Pass", "2S", "Pass", "4S", "Pass", "Pass", "Pass"])
    assert r.json()["declarer"] == "N"


def test_assess_opponents_contract(client):
    # Dealer N passes, East bids 1H and it's passed out: declarer is E.
    r = _assess(client, ["Pass", "1H", "Pass", "Pass", "Pass"])
    b = r.json()
    assert b["declarer"] == "E"
    assert b["contract"] == "1H"


def test_assess_doubled_contract(client):
    r = _assess(client, ["1NT", "X", "Pass", "Pass", "Pass"])
    assert r.json()["contract"] == "1NTX"


def test_assess_passed_out(client):
    r = _assess(client, ["Pass", "Pass", "Pass", "Pass"])
    b = r.json()
    assert b["contract"] is None and b["declarer"] is None
    assert b["makes"] is False


def test_assess_reports_par_and_table(client):
    b = _assess(client, ["1NT", "Pass", "Pass", "Pass"]).json()
    assert "3NT" in b["optimal_result"]              # par is 3NT N/S
    assert b["makeable_contracts"]["N"]["D"] == 10   # N makes 10 diamonds DD


def test_assess_invalid_deal_422(client):
    r = client.post("/assess", json={"deal": "not a deal", "final_auction": []})
    assert r.status_code == 422


def test_assess_invalid_dealer_422(client):
    r = client.post("/assess", json={"deal": DEAL, "final_auction": [], "dealer": "Z"})
    assert r.status_code == 422
