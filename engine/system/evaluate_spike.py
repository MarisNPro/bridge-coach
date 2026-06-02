"""Reference evaluator for the Natural system data (Phase 1 spike).

Proves the data structure in natural-v1.yaml is executable: load the
system, feed a hand + situation, get back the call + meaning. This is
the seed of the engine's /bid handler — the bot, conformance check,
and question layers all read the same file through logic like this.

Run:  python evaluate_spike.py
"""
import os
import yaml

HCP_VALUE = {"A": 4, "K": 3, "Q": 2, "J": 1}
SUITS = ["spades", "hearts", "diamonds", "clubs"]
SYMBOL = {"spades": "S", "hearts": "H", "diamonds": "D", "clubs": "C"}
BALANCED_SHAPES = {(4, 3, 3, 3), (4, 4, 3, 2), (5, 3, 3, 2)}


def hand_features(hand):
    """hand: {'S': 'AK1064', 'H': 'K3', 'D': 'Q542', 'C': 'J7'} (T = ten).

    Returns hcp, per-suit lengths, and whether the hand is balanced.
    """
    lengths, hcp, top3, stoppers = {}, 0, {}, {}
    for suit in SUITS:
        holding = hand[SYMBOL[suit]]
        n = len(holding)
        lengths[suit] = n
        hcp += sum(HCP_VALUE.get(card, 0) for card in holding)
        top3[suit] = sum(card in ("A", "K", "Q") for card in holding)
        stoppers[suit] = (
            "A" in holding
            or ("K" in holding and n >= 2)
            or ("Q" in holding and n >= 3)
            or ("J" in holding and n >= 4)
        )
    shape = tuple(sorted(lengths.values(), reverse=True))
    return {"hcp": hcp, "lengths": lengths, "top3": top3, "stoppers": stoppers,
            "balanced": shape in BALANCED_SHAPES}


def meets(conditions, f):
    """True if a hand's features satisfy a rule's `conditions` block.

    Only the executable predicates live here. Everything else in a rule
    (meaning, promised, ...) is descriptive and ignored by the bot.
    """
    hcp = conditions.get("hcp", {})
    if "min" in hcp and f["hcp"] < hcp["min"]:
        return False
    if "max" in hcp and f["hcp"] > hcp["max"]:
        return False

    if "balanced" in conditions and f["balanced"] != conditions["balanced"]:
        return False

    for suit, rng in conditions.get("length", {}).items():
        n = f["lengths"][suit]
        if "min" in rng and n < rng["min"]:
            return False
        if "max" in rng and n > rng["max"]:
            return False

    for cmp in conditions.get("compare", []):
        left, right = f["lengths"][cmp["left"]], f["lengths"][cmp["right"]]
        if cmp["op"] == "ge" and not left >= right:
            return False
        if cmp["op"] == "gt" and not left > right:
            return False

    if "four_card_major" in conditions:
        has = f["lengths"]["spades"] >= 4 or f["lengths"]["hearts"] >= 4
        if conditions["four_card_major"] != has:
            return False

    th = conditions.get("top3_honors")
    if th and f["top3"][th["suit"]] < th["min"]:
        return False

    si = conditions.get("stopper_in")
    if si and not f["stoppers"][si]:
        return False

    return True


def decide(system, situation_id, hand):
    """Return (call, meaning, promised) for the first matching rule."""
    f = hand_features(hand)
    situation = next(s for s in system["situations"] if s["id"] == situation_id)
    for rule in situation["rules"]:
        if meets(rule.get("conditions", {}), f):
            return rule["call"], rule["meaning"], rule.get("promised"), f
    return None, "no rule matched", None, f


def load_system(path=None):
    path = path or os.path.join(os.path.dirname(__file__), "natural-v1.yaml")
    with open(path) as fh:
        return yaml.safe_load(fh)


# --------------------------------------------------------------------
# Self-test: one hand per opening branch + a few responder hands.
# --------------------------------------------------------------------
CASES = [
    # ---- opening ----
    ("open: 26 any -> 2C",        {"S": "AKQJ", "H": "AKQ",  "D": "AK2",   "C": "432"},  "opening", "2C"),
    ("open: 20 bal -> 2NT",       {"S": "AKQ",  "H": "KQJ",  "D": "KQ2",   "C": "5432"}, "opening", "2NT"),
    ("open: 15 bal -> 1NT",       {"S": "AQ4",  "H": "KJ3",  "D": "KQ52",  "C": "432"},  "opening", "1NT"),
    ("open: 5 spades -> 1S",      {"S": "AKQ32","H": "K54",  "D": "Q32",   "C": "43"},   "opening", "1S"),
    ("open: 5-5 majors -> 1S",    {"S": "AK432","H": "KQ987","D": "65",    "C": "2"},    "opening", "1S"),
    ("open: 6h-5s -> 1H",         {"S": "AK432","H": "KQ9876","D": "2",    "C": "3"},    "opening", "1H"),
    ("open: 4-4-3-2 (3d2c) -> 1D",{"S": "KQ54", "H": "A432", "D": "K76",   "C": "32"},   "opening", "1D"),
    ("open: 4-4 minors -> 1D",    {"S": "KQ3",  "H": "A4",   "D": "KJ32",  "C": "5432"}, "opening", "1D"),
    ("open: 3-3 minors -> 1C",    {"S": "KQ54", "H": "A32",  "D": "Q43",   "C": "J32"},  "opening", "1C"),
    ("open: clubs longer -> 1C",  {"S": "KQ4",  "H": "A3",   "D": "Q4",    "C": "J7654"},"opening", "1C"),
    ("open: 7 spades 7hcp -> 3S", {"S": "QJ98765","H": "K2", "D": "43",    "C": "32"},   "opening", "3S"),
    ("open: weak 6h good -> 2H",  {"S": "432",  "H": "KQ9876","D": "K2",   "C": "43"},   "opening", "2H"),
    ("open: weak 6s good -> 2S",  {"S": "AQ9876","H": "K2",  "D": "432",   "C": "43"},   "opening", "2S"),
    ("open: 6h poor suit -> Pass",{"S": "432",  "H": "J98765","D": "K2",   "C": "43"},   "opening", "Pass"),
    ("open: 6 bal -> Pass",       {"S": "Q32",  "H": "J43",  "D": "Q432",  "C": "J32"},  "opening", "Pass"),

    # ---- responses to 1C ----
    ("1C: 4d4h up the line -> 1D",{"S": "32",   "H": "KQ32", "D": "AJ32",  "C": "432"},  "resp-1c", "1D"),
    ("1C: 4 hearts -> 1H",        {"S": "32",   "H": "KQ32", "D": "K32",   "C": "4321"}, "resp-1c", "1H"),
    ("1C: 4 spades -> 1S",        {"S": "KQ32", "H": "432",  "D": "K32",   "C": "432"},  "resp-1c", "1S"),
    ("1C: 13 bal noM -> 3NT",     {"S": "AQ3",  "H": "KJ2",  "D": "Q92",   "C": "K543"}, "resp-1c", "3NT"),
    ("1C: 11 bal noM -> 2NT",     {"S": "KQ3",  "H": "Q92",  "D": "KJ2",   "C": "5432"}, "resp-1c", "2NT"),
    ("1C: 8 bal noM -> 1NT",      {"S": "K32",  "H": "Q92",  "D": "Q32",   "C": "5432"}, "resp-1c", "1NT"),
    ("1C: 7 5clubs -> 2C",        {"S": "K32",  "H": "Q2",   "D": "32",    "C": "Q5432"},"resp-1c", "2C"),
    ("1C: 11 5clubs -> 3C",       {"S": "K32",  "H": "Q2",   "D": "K2",    "C": "QJ432"},"resp-1c", "3C"),
    ("1C: 3hcp -> Pass",          {"S": "J32",  "H": "432",  "D": "Q432",  "C": "432"},  "resp-1c", "Pass"),

    # ---- responses to 1D ----
    ("1D: 4 hearts -> 1H",        {"S": "32",   "H": "KQ32", "D": "K32",   "C": "4321"}, "resp-1d", "1H"),
    ("1D: 4 spades -> 1S",        {"S": "KQ32", "H": "32",   "D": "K32",   "C": "4321"}, "resp-1d", "1S"),
    ("1D: 11 5clubs -> 2C",       {"S": "K2",   "H": "Q2",   "D": "32",    "C": "AJ9432"},"resp-1d","2C"),
    ("1D: 8 5diamonds -> 2D",     {"S": "K32",  "H": "Q2",   "D": "Q5432", "C": "432"},  "resp-1d", "2D"),
    ("1D: 8 bal noM -> 1NT",      {"S": "K32",  "H": "Q92",  "D": "Q43",   "C": "5432"}, "resp-1d", "1NT"),

    # ---- responses to 1H ----
    ("1H: 13 4hearts -> 2NT(Jac)",{"S": "A32",  "H": "KQ32", "D": "KJ2",   "C": "432"},  "resp-1h", "2NT"),
    ("1H: 6 4spades -> 1S",       {"S": "KQ32", "H": "32",   "D": "K432",  "C": "432"},  "resp-1h", "1S"),
    ("1H: 11 4hearts -> 3H",      {"S": "K3",   "H": "KQ32", "D": "Q432",  "C": "432"},  "resp-1h", "3H"),
    ("1H: 7 3hearts -> 2H",       {"S": "K32",  "H": "Q32",  "D": "Q432",  "C": "432"},  "resp-1h", "2H"),
    ("1H: 7 <=2hearts -> 1NT",    {"S": "K32",  "H": "32",   "D": "Q432",  "C": "Q432"}, "resp-1h", "1NT"),
    ("1H: weak 5hearts -> 4H",    {"S": "2",    "H": "Q5432","D": "9876",  "C": "543"},  "resp-1h", "4H"),
    ("1H: 4hcp -> Pass",          {"S": "J32",  "H": "32",   "D": "Q432",  "C": "4321"}, "resp-1h", "Pass"),

    # ---- responses to 1S ----
    ("1S: 13 4spades -> 2NT(Jac)",{"S": "KQ32", "H": "A32",  "D": "KJ2",   "C": "432"},  "resp-1s", "2NT"),
    ("1S: 11 4spades -> 3S",      {"S": "KQ32", "H": "K3",   "D": "Q432",  "C": "432"},  "resp-1s", "3S"),
    ("1S: 7 3spades -> 2S",       {"S": "K32",  "H": "Q32",  "D": "Q432",  "C": "432"},  "resp-1s", "2S"),
    ("1S: 8 <=2spades -> 1NT",    {"S": "K2",   "H": "Q32",  "D": "Q432",  "C": "J432"}, "resp-1s", "1NT"),
    ("1S: 10 5hearts -> 2H",      {"S": "32",   "H": "AQ432","D": "KJ2",   "C": "432"},  "resp-1s", "2H"),

    # ---- responses to 1NT ----
    ("1NT: 5 hearts -> 2D(xfer)", {"S": "32",   "H": "Q5432","D": "K32",   "C": "432"},  "resp-1nt", "2D"),
    ("1NT: 5 spades -> 2H(xfer)", {"S": "Q5432","H": "32",   "D": "K32",   "C": "432"},  "resp-1nt", "2H"),
    ("1NT: 9 4spades -> 2C(Stay)",{"S": "KJ32", "H": "Q32",  "D": "Q32",   "C": "J32"},  "resp-1nt", "2C"),
    ("1NT: 17 bal -> 4NT(quant)", {"S": "AQ3",  "H": "KJ3",  "D": "KQ2",   "C": "Q432"}, "resp-1nt", "4NT"),
    ("1NT: 12 bal noM -> 3NT",    {"S": "K32",  "H": "Q32",  "D": "KQ32",  "C": "Q32"},  "resp-1nt", "3NT"),
    ("1NT: 8 bal noM -> 2NT",     {"S": "K32",  "H": "Q32",  "D": "K432",  "C": "432"},  "resp-1nt", "2NT"),
    ("1NT: 5 noM -> Pass",        {"S": "J32",  "H": "432",  "D": "Q432",  "C": "432"},  "resp-1nt", "Pass"),

    # ---- opener after Stayman ----
    ("Stayman ans: 4hearts -> 2H",{"S": "AQ4",  "H": "KJ32", "D": "KQ2",   "C": "K3"},   "opener-after-stayman", "2H"),
    ("Stayman ans: 4spades -> 2S",{"S": "KJ32", "H": "AQ4",  "D": "KQ2",   "C": "K3"},   "opener-after-stayman", "2S"),
    ("Stayman ans: no major -> 2D",{"S": "AQ4", "H": "KJ3",  "D": "KQ32",  "C": "K3"},   "opener-after-stayman", "2D"),

    # ---- transfer acceptances (forced) ----
    ("xfer to H: accept -> 2H",   {"S": "AQ4",  "H": "KJ3",  "D": "KQ32",  "C": "K3"},   "opener-accept-transfer-hearts", "2H"),
    ("xfer to S: accept -> 2S",   {"S": "AQ4",  "H": "KJ3",  "D": "KQ32",  "C": "K3"},   "opener-accept-transfer-spades", "2S"),

    # ---- responses to 2C ----
    ("2C: 9 bal -> 2NT",          {"S": "K32",  "H": "Q32",  "D": "K432",  "C": "Q32"},  "resp-2c", "2NT"),
    ("2C: weak -> 2D waiting",    {"S": "J32",  "H": "432",  "D": "8432",  "C": "432"},  "resp-2c", "2D"),

    # ---- responses to weak 2H ----
    ("2H resp: 19 bal -> 3NT",    {"S": "AQ4",  "H": "K3",   "D": "AQ32",  "C": "KJ32"}, "resp-2h", "3NT"),
    ("2H resp: 16 unbal -> 2NT",  {"S": "AKJ32","H": "3",    "D": "AQ32",  "C": "K43"},  "resp-2h", "2NT"),
    ("2H resp: 4hearts -> 4H",    {"S": "32",   "H": "K432", "D": "8432",  "C": "543"},  "resp-2h", "4H"),
    ("2H resp: 10 3hearts -> 3H", {"S": "K32",  "H": "Q32",  "D": "KQ2",   "C": "5432"}, "resp-2h", "3H"),
    ("2H resp: weak -> Pass",     {"S": "J32",  "H": "32",   "D": "8432",  "C": "5432"}, "resp-2h", "Pass"),

    # ---- direct overcalls over 1C ----
    ("o1C: 17 bal stop -> 1NT",   {"S": "AQ4",  "H": "KJ3",  "D": "Q432",  "C": "KQ5"},   "direct-over-1c", "1NT"),
    ("o1C: 14 short clubs -> X",  {"S": "KQ32", "H": "AQ32", "D": "K432",  "C": "2"},    "direct-over-1c", "X"),
    ("o1C: 5-5 majors -> 2C(Mich)",{"S": "KQ987","H": "QJ876","D": "2",    "C": "32"},   "direct-over-1c", "2C"),
    ("o1C: 5-5 reds -> 2NT(Unus)",{"S": "32",   "H": "KJ876","D": "QJ876", "C": "2"},    "direct-over-1c", "2NT"),
    ("o1C: 9 5diamonds -> 1D",    {"S": "K32",  "H": "32",   "D": "AQ876", "C": "432"},  "direct-over-1c", "1D"),
    ("o1C: weak 6hearts -> 2H",   {"S": "3",    "H": "QJ9876","D": "K32",  "C": "432"},  "direct-over-1c", "2H"),
    ("o1C: junk -> Pass",         {"S": "J32",  "H": "J32",  "D": "J32",   "C": "J432"}, "direct-over-1c", "Pass"),

    # ---- direct overcalls over 1S ----
    ("o1S: 11 5hearts -> 2H",     {"S": "32",   "H": "AQ876","D": "KJ3",   "C": "432"},  "direct-over-1s", "2H"),
    ("o1S: 14 short spades -> X", {"S": "2",    "H": "KQ32", "D": "AQ32",  "C": "K432"}, "direct-over-1s", "X"),

    # ---- responding to partner's takeout double of 1H ----
    ("Xo1H: 17 stop -> 3NT",      {"S": "AQ3",  "H": "KJ3",  "D": "KQ32",  "C": "Q42"},   "respond-takeout-over-1h", "3NT"),
    ("Xo1H: 14 no stop -> 2H cue",{"S": "AQ32", "H": "32",   "D": "KQ32",  "C": "K32"},  "respond-takeout-over-1h", "2H"),
    ("Xo1H: 4 -> min suit 1S",    {"S": "Q876", "H": "32",   "D": "432",   "C": "5432"}, "respond-takeout-over-1h", "1S"),

    # ---- DONT defence to their 1NT ----
    ("dont: both majors -> 2H",   {"S": "KJ32", "H": "AQ876","D": "32",    "C": "43"},   "defend-their-1nt", "2H"),

    # ---- after they double our 1NT ----
    ("adn: 10 -> XX",             {"S": "K32",  "H": "Q32",  "D": "KQ32",  "C": "Q32"},  "after-double-of-our-1nt", "XX"),
    ("adn: weak -> Pass",         {"S": "J32",  "H": "432",  "D": "J432",  "C": "432"},  "after-double-of-our-1nt", "Pass"),

    # ---- over their pre-empts ----
    ("o2H: 14 short H -> X",      {"S": "KQ32", "H": "2",    "D": "AQ32",  "C": "K432"}, "over-their-2h", "X"),
    ("o3S: 14 short S -> X",      {"S": "2",    "H": "KQ32", "D": "AQ32",  "C": "K43"},  "over-their-3s", "X"),

    # ---- responder after interference ----
    ("1C-(1S): 8 4hearts -> negX",{"S": "32",   "H": "KQ32", "D": "K432",  "C": "432"},  "resp-1c-over-1s", "X"),
    ("1C-(1S): 14 no M -> 2S cue",{"S": "32",   "H": "K3",   "D": "AQ432", "C": "KQ32"}, "resp-1c-over-1s", "2S"),
    ("1H-(1S): 7 4hearts -> 2H",  {"S": "32",   "H": "KQ32", "D": "Q432",  "C": "432"},  "resp-1h-over-1s", "2H"),
    ("1H-(1S): 10 stop -> 1NT",   {"S": "K32",  "H": "32",   "D": "KQ32",  "C": "Q432"}, "resp-1h-over-1s", "1NT"),

    # ---- opener after interference ----
    ("1C-(1S) opener 14 bal->1NT",{"S": "K32",  "H": "Q32",  "D": "K432",  "C": "AQ2"},  "opener-after-1c-1s", "1NT"),
    ("1C-(1S) opener 9 -> Pass",  {"S": "32",   "H": "432",  "D": "K432",  "C": "AQ32"}, "opener-after-1c-1s", "Pass"),

    # ---- advancing partner's overcall ----
    ("adv 1S/o1H: 13 -> 2H cue",  {"S": "KQ3",  "H": "32",   "D": "KQ32",  "C": "K32"},  "advance-1h-overcall-1s", "2H"),
    ("adv 1S/o1H: weak 4sp -> 3S",{"S": "Q876", "H": "432",  "D": "K32",   "C": "432"},  "advance-1h-overcall-1s", "3S"),
]


def main():
    system = load_system()
    width = max(len(d) for d, *_ in CASES)
    failures = 0
    print(f"System: {system['name']} ({system['id']})  "
          f"[{sum(len(s['rules']) for s in system['situations'])} rules]\n")
    for desc, hand, sit, expected in CASES:
        call, _meaning, _promised, f = decide(system, sit, hand)
        ok = call == expected
        failures += not ok
        flag = "ok " if ok else "XX "
        print(f"{flag}{desc:<{width}}  hcp={f['hcp']:>2} "
              f"shape={'-'.join(str(f['lengths'][s]) for s in SUITS)}  "
              f"-> {call!s:<4} (want {expected})")
    print()
    if failures:
        print(f"{failures} of {len(CASES)} FAILED")
        raise SystemExit(1)
    print(f"all {len(CASES)} cases passed")


if __name__ == "__main__":
    main()
