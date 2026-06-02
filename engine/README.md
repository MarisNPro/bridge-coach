# Bridge Engine (Phase 0 skeleton)

Stateless FastAPI service. Computes only — all persistence lives in Supabase.
Phase 0 ships a health check and stubbed `/bid`, `/assess`, `/explain`
endpoints (HTTP 501 until Phase 1).

## Run locally
    pip install -r requirements.txt
    uvicorn app.main:app --reload
    # http://localhost:8000/health  ->  {"status":"ok","phase":0}
    # http://localhost:8000/docs    ->  interactive API

## Deploy (Railway)
Point Railway at this directory; it builds the Dockerfile and injects $PORT.
Keep the service stateless so the container stays freely redeployable.

## Phase 1 next steps
- Implement the system bidder behind `/bid` (system-as-data).
- Wire the DDS solver (via `endplay`) behind `/assess`.
- Add the templated explanation layer behind `/explain` (LLM optional).
