"""Bridge engine service — Phase 0 skeleton.

Stateless by design: all persistence lives in Supabase. This service
only computes (bidding, assessment, explanation). Phase 0 ships the
skeleton with a health check and stubbed endpoints so it can be
deployed to Railway and wired to the web app before Phase 1 logic.
"""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import bid, assess, explain

app = FastAPI(title="Bridge Engine", version="0.0.0")

# Lock this down to the web app origin(s) before the pilot.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "phase": 0}


app.include_router(bid.router, tags=["engine"])
app.include_router(assess.router, tags=["engine"])
app.include_router(explain.router, tags=["engine"])
