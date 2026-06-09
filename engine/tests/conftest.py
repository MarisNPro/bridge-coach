"""Shared fixtures for the engine test suite.

Puts the engine root on sys.path (so `from app...` works when pytest is run
from anywhere) and exposes a FastAPI TestClient for the HTTP-boundary tests.
"""
import os
import sys

import pytest
from fastapi.testclient import TestClient

ENGINE_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ENGINE_ROOT)

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    return TestClient(app)
