def test_liveness_returns_standard_success_response(client):
    response = client.get("/api/health")

    assert response.status_code == 200
    body = response.get_json()
    assert body["meta"]["status"] == "success"
    assert body["data"]["service"] == "gempa-dbscan-backend"
    assert body["data"]["status"] == "alive"


def test_response_contains_request_id(client):
    response = client.get("/api/health")

    assert response.headers.get("X-Request-ID")


def test_request_id_can_be_correlated(client):
    response = client.get("/api/health", headers={"X-Request-ID": "test-request-001"})

    assert response.headers["X-Request-ID"] == "test-request-001"


def test_unknown_route_uses_standard_error_response(client):
    response = client.get("/api/does-not-exist")

    assert response.status_code == 404
    body = response.get_json()
    assert body["data"] is None
    assert body["meta"]["status"] == "error"
    assert body["meta"]["code"] == "NOT_FOUND"
