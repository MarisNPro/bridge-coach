"""Coverage vetting for the system data.

A situation is "vettable" for the practice pool only if EVERY possible hand in
that seat matches some rule — the bot must never return a null call (which the
UI would surface as a dead end). This brute-forces N random 13-card hands
through the runtime bidder for each situation and reports any null calls, with
the offending hands, so gaps can be closed before a situation is drilled.

    python system/vet.py                 # vet every situation, 20k hands each
    python system/vet.py resp-1c resp-1d # only these
    python system/vet.py -n 50000        # bigger sample

Exit code is non-zero if any situation has a gap, so it can gate CI.
"""
import argparse
import os
import random
import sys

ENGINE_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ENGINE_ROOT)

from app import bidder  # noqa: E402

RANKS = "AKQJT98765432"
SUITS = "SHDC"
_DECK = [(s, r) for s in SUITS for r in RANKS]


def random_hand() -> dict:
    cards = random.sample(_DECK, 13)
    d = {s: "" for s in SUITS}
    for s, r in cards:
        d[s] += r
    return d


def vet_situation(system: dict, sit: dict, n: int) -> list[dict]:
    """Return a list of {hand, hcp, shape} for hands that get no call."""
    auction = list(sit["_auction_key"])
    seat = sit["_seat"]
    gaps = []
    for _ in range(n):
        hand = random_hand()
        try:
            res = bidder.decide(system, auction, hand, seat)
        except Exception as exc:  # a raised error is as bad as a null call
            gaps.append({"hand": _fmt(hand), "error": repr(exc)})
            continue
        if res["call"] is None:
            f = res["features"]
            gaps.append({"hand": _fmt(hand), "hcp": f["hcp"], "shape": f["shape"]})
    return gaps


def _fmt(hand: dict) -> str:
    return ".".join(hand[s] or "-" for s in SUITS)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("situations", nargs="*", help="situation ids (default: all)")
    ap.add_argument("-n", type=int, default=20000, help="random hands per situation")
    ap.add_argument("--system", default="natural-v1")
    ap.add_argument("--seed", type=int, default=0)
    args = ap.parse_args()

    random.seed(args.seed)
    system = bidder.load_system(args.system)
    by_id = {s["id"]: s for s in system["situations"]}
    wanted = args.situations or [s["id"] for s in system["situations"]]

    total_gaps = 0
    for sid in wanted:
        sit = by_id.get(sid)
        if sit is None:
            print(f"?? {sid}: no such situation")
            total_gaps += 1
            continue
        gaps = vet_situation(system, sit, args.n)
        if not gaps:
            print(f"ok {sid}: {args.n} hands, 0 gaps")
            continue
        total_gaps += len(gaps)
        print(f"XX {sid}: {len(gaps)}/{args.n} hands got NO call. Examples:")
        for g in gaps[:8]:
            if "error" in g:
                print(f"     {g['hand']}  ERROR {g['error']}")
            else:
                print(f"     {g['hand']}  hcp={g['hcp']} shape={g['shape']}")

    print()
    if total_gaps:
        print(f"GAPS FOUND in {sum(1 for s in wanted if s in by_id)} situations checked.")
        raise SystemExit(1)
    print(f"all {len(wanted)} situations covered.")


if __name__ == "__main__":
    main()
