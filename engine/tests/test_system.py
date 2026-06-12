"""/system — the active system's metadata + coach-amendable toggles (read-only)."""


def test_system_returns_metadata_and_toggles(client):
    r = client.get("/system")
    assert r.status_code == 200
    body = r.json()
    assert body["id"] == "natural-v1"
    assert body["name"]
    assert body["toggles"]["nt_range"] == {"min": 15, "max": 17}
    assert body["toggles"]["open_min_hcp"] == 12
    assert body["situations"] >= 60       # grows as coverage expands
    assert body["rules"] >= 400


def test_system_unknown_404(client):
    r = client.get("/system", params={"system_id": "no-such-system"})
    assert r.status_code == 404
    assert "no-such-system" in r.json()["detail"]
