"""Parity guard: the runtime bidder (app/bidder.py) must reproduce the
reference evaluator (system/evaluate_spike.py) on all of its validated hands.

If this fails, the runtime engine has drifted from the data that was signed
off in the Phase 1 spike. Run with `pytest` or directly: `python tests/test_parity.py`.
"""
import importlib.util
import os
import sys

ENGINE_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ENGINE_ROOT)

from app import bidder  # noqa: E402


def _load_spike():
    path = os.path.join(ENGINE_ROOT, "system", "evaluate_spike.py")
    spec = importlib.util.spec_from_file_location("spike", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_runtime_matches_spike():
    spike = _load_spike()
    system = bidder.load_system("natural-v1")
    by_id = {s["id"]: s for s in system["situations"]}
    mismatches = []
    for desc, hand, sit_id, expected in spike.CASES:
        sit = by_id[sit_id]
        res = bidder.decide(system, list(sit["_auction_key"]), hand, sit["_seat"])
        if res["call"] != expected:
            mismatches.append(f"{desc}: got {res['call']} want {expected}")
    assert not mismatches, "runtime bidder drifted from spike:\n" + "\n".join(mismatches)


if __name__ == "__main__":
    test_runtime_matches_spike()
    spike = _load_spike()
    print(f"parity OK: {len(spike.CASES)}/{len(spike.CASES)} cases match the spike")
