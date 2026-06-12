"""Lightweight engine observability — a stdout logger Railway captures.

No PII: the engine is stateless and anonymous (auth lives in Supabase); it only
sees hands / auctions / situation ids. We log request status + latency and a
per-bid / per-conformance line so usage (which situations are drilled, how often
calls conform) and errors are visible in the platform logs.
"""
import logging
import sys

logger = logging.getLogger("bridge")
if not logger.handlers:
    _h = logging.StreamHandler(sys.stdout)
    _h.setFormatter(logging.Formatter("%(asctime)s %(levelname)s bridge %(message)s"))
    logger.addHandler(_h)
    logger.setLevel(logging.INFO)
    logger.propagate = False
