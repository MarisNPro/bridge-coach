"""Coverage guard: no situation may ever return a null call.

The practice pool's contract is that any random hand in a situation's seat gets
a real bid — a null call would be a dead end in the UI. This runs the vetter
(system/vet.py) over every situation with a modest sample so a future rule edit
that reopens a gap fails CI. vet.py with a big -n is the exhaustive check; this
is the fast always-on guard.
"""
import importlib.util
import os

import pytest

ENGINE_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

_spec = importlib.util.spec_from_file_location(
    "vet", os.path.join(ENGINE_ROOT, "system", "vet.py")
)
vet = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(vet)

from app import bidder  # noqa: E402

SAMPLE = 5000


@pytest.mark.parametrize("sit", bidder.load_system("natural-v1")["situations"],
                         ids=lambda s: s["id"])
def test_situation_has_no_null_call(sit):
    system = bidder.load_system("natural-v1")
    gaps = vet.vet_situation(system, sit, SAMPLE)
    assert not gaps, (
        f"{sit['id']}: {len(gaps)}/{SAMPLE} hands got no call, e.g. {gaps[:3]}"
    )
