"""Non-cheating Monte-Carlo play bot (/bot).

A deterministic round-robin deal (card i -> seat i%4) gives mixed hands. The bot
is only ever given the hands it may see; the rest are sampled.
"""
from app import bot

DECK = [s + r for s in "SHDC" for r in "AKQJT98765432"]
_H = {s: [] for s in "NESW"}
for _i, _c in enumerate(DECK):
    _H["NESW"[_i % 4]].append(_c)
HOLD = {s: bot._fmt_hand(_H[s]) for s in "NESW"}  # dotted 'S.H.D.C' per seat


def test_suggests_a_legal_card_deterministically():
    a = bot.suggest_card({"W": HOLD["W"]}, [], "NT", "S", samples=10, seed=1)
    b = bot.suggest_card({"W": HOLD["W"]}, [], "NT", "S", samples=10, seed=1)
    assert a["card"] == b["card"]          # same seed -> same choice
    assert a["to_act"] == "W"              # opening leader = declarer's LHO
    assert a["card"] in set(_H["W"])       # a card the bot actually holds
    assert a["candidates"]


def test_non_cheating_only_needs_the_bots_own_hand():
    # Only W is provided; N/E/S are concealed and sampled — the engine never
    # receives them, so it cannot use them.
    res = bot.suggest_card({"W": HOLD["W"]}, [], "NT", "S", samples=5, seed=2)
    assert res["card"] in set(_H["W"])


def test_follows_suit_when_able():
    # W leads S3; N (which holds spades) must follow suit.
    res = bot.suggest_card({"N": HOLD["N"]}, ["S3"], "NT", "S", samples=5, seed=3)
    assert res["to_act"] == "N"
    assert all(c["card"][0] == "S" for c in res["candidates"])


def test_bot_endpoint(client):
    r = client.post("/bot", json={"known_hands": {"W": HOLD["W"]}, "played": [],
                                  "strain": "NT", "declarer": "S", "samples": 8, "seed": 1})
    assert r.status_code == 200
    body = r.json()
    assert body["card"] in set(_H["W"])
    assert body["to_act"] == "W"
    assert len(body["candidates"]) == 13   # 13 legal opening leads


def test_bot_422_when_to_act_not_among_known(client):
    # The opening leader is W, but only N is provided.
    r = client.post("/bot", json={"known_hands": {"N": HOLD["N"]}, "played": [],
                                  "strain": "NT", "declarer": "S"})
    assert r.status_code == 422
