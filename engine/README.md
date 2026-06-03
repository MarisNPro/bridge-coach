# Bridge Engine

Stateless FastAPI service that computes bridge correctness. All persistence
lives in Supabase; this service only decides and narrates. Engines decide;
the LLM only narrates on top of these outputs.

## Status

- **Phase 0:** skeleton + health check. ✅
- **Phase 1:** bidding endpoints wired to the system-as-data bidder. ✅
  - `POST /bid` — the system bot
  - `POST /conformance` — grade a student's call
  - `POST /explain` — what a call means / promises (questions layer)
- `POST /assess` — double-dummy + result grading. Still **501** (needs the
  endplay/DDS spike).

The three live endpoints all read one file — `system/natural-v1.yaml` — through
`app/bidder.py`. No bridge logic is duplicated across them. See
`system/schema.md` for the data contract.

## Run locally

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload
# http://127.0.0.1:8000/health  ->  {"status":"ok","phase":1}
# interactive docs at /docs
```

## Endpoints

`hand` is a dotted `S.H.D.C` holding (`T` or `10` = ten). `auction` lists the
calls so far with opponents' calls in `(parentheses)`, matching the data. When
an auction is used by two seats (e.g. `["1C","(1S)"]` → opener vs responder),
pass `seat` to disambiguate.

```bash
# Bot: what does the system open with 15 balanced?
curl -s localhost:8000/bid -H 'content-type: application/json' \
  -d '{"hand":"AQ4.KJ3.KQ52.432","auction":[],"system_id":"natural-v1"}'
# -> {"call":"1NT","meaning":"Balanced 15-17 ...","promised":{...},"situation_id":"opening"}

# Conformance: did the student make the system's call?
curl -s localhost:8000/conformance -H 'content-type: application/json' \
  -d '{"hand":"AQ4.KJ3.KQ52.432","auction":[],"call":"1C"}'
# -> {"conformant":false,"expected_call":"1NT", ...}

# Explain: what does opener's 1NT promise?
curl -s localhost:8000/explain -H 'content-type: application/json' \
  -d '{"auction":[],"call":"1NT"}'
```

Errors: malformed hand or unselectable/ambiguous auction → `422`; unknown
`system_id` → `404`.

## Tests

```bash
python tests/test_parity.py     # runtime bidder == validated spike (85 cases)
```

## CORS

`ENGINE_ALLOWED_ORIGINS` (comma-separated) controls allowed origins; defaults
to `*` for local dev. **Set it to the web app origin on Railway before the pilot.**

## Deploy (Railway)

Docker image builds the toolchain for endplay (Phase 1 `/assess`), installs
requirements, and copies both `app/` and `system/` (the data file must ship).
Railway provides `$PORT`.
