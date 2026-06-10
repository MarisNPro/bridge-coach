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
- `POST /assess` — double-dummy assessment of a played deal (endplay/DDS). ✅
  Solves the deal's double-dummy table, derives the contract from the auction
  (declarer, level, strain, double), and reports makes/result, par, and the
  full makeable table. `conformance` = the contract makes double-dummy.
- `POST /play` — double-dummy play oracle for interactive card play. ✅
  Stateless: given the deal, contract, and cards played so far, returns the seat
  to act, the current trick, each legal card with its double-dummy value, and
  trick counts. The client orchestrates whose turn is human vs auto.

The bidding endpoints all read one file — `system/natural-v1.yaml` — through
`app/bidder.py`; `/assess` and `/play` read the deal through `app/assessor.py`
and `app/play.py` (DDS only, no bidding logic). No bridge logic is duplicated.
See `system/schema.md` for the bidding data contract.

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

# Assess: did the played contract make double-dummy? (full deal + auction)
curl -s localhost:8000/assess -H 'content-type: application/json' \
  -d '{"deal":"N:J843.A85.AQJ84.2 KQ9.T963.97.T965 752.KJ72.K5.AQJ4 AT6.Q4.T632.K873",
       "final_auction":["4S","Pass","Pass","Pass"],"dealer":"N"}'
# -> {"contract":"4S","declarer":"N","tricks_made":9,"result":-1,"makes":false, ...}

# Play: whose turn, legal cards + double-dummy values for the current position
curl -s localhost:8000/play -H 'content-type: application/json' \
  -d '{"deal":"N:AJT8.T9.972.A853 K75.AJ53.QJ83.J4 964.K8.AKT5.Q962 Q32.Q7642.64.KT7",
       "strain":"NT","declarer":"S","played":[]}'
# -> {"to_act":"W","legal":[{"card":"H2","dd":5}, ...],"declarer_tricks":0, ...}
```

For `/assess`, `deal` is a full PBN deal and `final_auction` is the complete
auction clockwise from `dealer` (plain calls). Errors: malformed hand or
unselectable/ambiguous auction → `422`; unknown `system_id` → `404`; bad PBN
deal / dealer / call → `422`.

## Tests

```bash
pip install -r requirements-dev.txt   # runtime + pytest/httpx (Python 3.12)
pytest                                # parity + HTTP-boundary tests
python tests/test_parity.py           # parity alone (only needs pyyaml)
```

- `test_parity.py` — runtime bidder reproduces the validated spike (150 cases).
- `test_bid.py` / `test_conformance.py` / `test_explain.py` — the live endpoints
  at the HTTP boundary: response shape, grading verdicts, call normalization.
- `test_errors.py` — the status-code contract: malformed hand / unselectable
  auction → 422, unknown system → 404, `/health`.
- `test_coverage.py` — every situation returns a real call for any random hand
  (no null calls), the contract the practice pool depends on.
- `test_assess.py` — `/assess` double-dummy results, contract/declarer parsing,
  par, and the makeable table (skipped if `endplay` isn't installed).
- `test_play.py` — `/play` oracle: opening lead, trick advancement + counts, a
  full 13-trick playthrough, and the 422 paths (also `endplay`-gated).

Coverage vetting can also be run directly, with a bigger sample, to find gaps
when editing the system data:

```bash
python system/vet.py                  # all situations, 20k hands each
python system/vet.py resp-1c -n 200000 # one situation, exhaustive
```

## CORS

`ENGINE_ALLOWED_ORIGINS` (comma-separated) controls allowed origins; defaults
to `*` for local dev. **Set it to the web app origin on Railway before the pilot.**

## Deploy (Railway)

Docker image builds the toolchain for endplay (Phase 1 `/assess`), installs
requirements, and copies both `app/` and `system/` (the data file must ship).
Railway provides `$PORT`.
