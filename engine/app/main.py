"""Bridge engine service.

Stateless by design: all persistence lives in Supabase. This service only
computes. Phase 1 wires the bidding endpoints (/bid, /conformance, /explain)
to the system-as-data bidder; /assess (double-dummy) lands with the DDS spike.
"""
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import bid, assess, explain, conformance, play

app = FastAPI(title="Bridge Engine", version="0.1.0")

# Allowed origins come from ENGINE_ALLOWED_ORIGINS (comma-separated).
# Defaults to "*" for local dev; set it to the web app origin(s) on Railway.
_origins = os.environ.get("ENGINE_ALLOWED_ORIGINS", "*")
allow_origins = ["*"] if _origins.strip() == "*" else [o.strip() for o in _origins.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "phase": 1}


app.include_router(bid.router, tags=["engine"])
app.include_router(conformance.router, tags=["engine"])
app.include_router(explain.router, tags=["engine"])
app.include_router(assess.router, tags=["engine"])
app.include_router(play.router, tags=["engine"])
