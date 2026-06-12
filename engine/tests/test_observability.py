"""Engine logging: every request is logged, and /bid /conformance emit a usage
line (situation + outcome). We capture the `bridge` logger directly so the test
doesn't depend on log propagation."""
import logging

import pytest


@pytest.fixture
def logs():
    records = []
    handler = logging.Handler()
    handler.emit = lambda r: records.append(r.getMessage())
    logger = logging.getLogger("bridge")
    logger.addHandler(handler)
    try:
        yield records
    finally:
        logger.removeHandler(handler)


def test_request_and_bid_are_logged(client, logs):
    r = client.post("/bid", json={"hand": "AQ4.KJ3.KQ52.432", "auction": []})
    assert r.status_code == 200
    joined = "\n".join(logs)
    assert "POST /bid -> 200" in joined          # request middleware
    assert "bid opening -> 1NT" in joined          # usage line


def test_conformance_logs_situation_and_outcome(client, logs):
    client.post("/conformance", json={"hand": "AQ4.KJ3.KQ52.432", "auction": [], "call": "1NT"})
    joined = "\n".join(logs)
    assert "conformance opening" in joined
    assert "conformant=True" in joined
