"""Unit tests for BMKG normalization, HTTP headers, and Redis cache behavior."""
import json
from io import BytesIO
from urllib.error import HTTPError

import pytest
from flask import Flask

from services import bmkg_realtime_service as bmkg_module
from services.bmkg_realtime_service import BMKGRealtimeError, BMKGRealtimeService


class FakeLock:
    def __init__(self, redis):
        self.redis = redis

    def acquire(self, blocking=True):
        return True

    def release(self):
        return None


class FakeRedis:
    def __init__(self):
        self.values = {}
        self.fail_writes = False

    def get(self, key):
        return self.values.get(key)

    def setex(self, key, ttl, value):
        if self.fail_writes:
            from redis.exceptions import RedisError
            raise RedisError("simulated cache write failure")
        self.values[key] = value

    def delete(self, key):
        self.values.pop(key, None)

    def lock(self, *args, **kwargs):
        return FakeLock(self)


@pytest.fixture
def app():
    app = Flask(__name__)
    app.config.update(
        BMKG_CACHE_SECONDS=60,
        BMKG_STALE_SECONDS=86400,
        BMKG_TIMEOUT_SECONDS=8,
        BMKG_USER_AGENT="UnitTest-WebGIS/1.0",
        BMKG_REFERER="https://www.bmkg.go.id/",
    )
    app.extensions["redis"] = FakeRedis()
    return app


def earthquake():
    return {
        "Tanggal": "14 Nov 2026",
        "Jam": "10:15:00 WIB",
        "DateTime": "2026-11-14T03:15:00+00:00",
        "Coordinates": "-6.20,106.80",
        "Lintang": "6.20 LS",
        "Bujur": "106.80 BT",
        "Magnitude": "4.8",
        "Kedalaman": "10 km",
        "Wilayah": "Contoh wilayah",
        "Potensi": "Tidak berpotensi tsunami",
        "Dirasakan": "II Jakarta",
        "Shakemap": "20261114031500.mmi.jpg",
    }


def latest_payload():
    return {"Infogempa": {"gempa": earthquake()}}


def list_payload():
    return {"Infogempa": {"gempa": [earthquake()]}}


def test_latest_normalizes_fields_and_coordinate_order(app):
    with app.app_context():
        service = BMKGRealtimeService(fetcher=lambda _url: latest_payload())
        result = service.get_latest()

    event = result["earthquake"]
    assert event["magnitude"] == 4.8
    assert event["depth_km"] == 10.0
    assert event["latitude"] == -6.2
    assert event["longitude"] == 106.8
    assert event["coordinates"] == [-6.2, 106.8]
    assert event["shakemap_url"].endswith("20261114031500.mmi.jpg")
    assert result["source"] == "BMKG"
    assert result["source_url"].endswith("autogempa.json")
    assert result["cache_status"] == "MISS"


def test_latest_accepts_list_payload_and_preserves_all_events(app):
    events = [earthquake(), earthquake()]
    payload = {"Infogempa": {"gempa": events}}
    with app.app_context():
        service = BMKGRealtimeService(fetcher=lambda _url: payload)
        result = service.get_latest()

    assert result["count"] == 2
    assert len(result["earthquakes"]) == 2
    assert result["earthquake"] == result["earthquakes"][0]


def test_list_feed_returns_array_and_cache_hit(app):
    calls = []

    def fetcher(url):
        calls.append(url)
        return list_payload()

    with app.app_context():
        service = BMKGRealtimeService(fetcher=fetcher)
        first = service.get_m5()
        second = service.get_m5()

    assert calls == ["https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json"]
    assert len(first["earthquakes"]) == 1
    assert first["count"] == 1
    assert first["cache_status"] == "MISS"
    assert second["cache_status"] == "HIT"


def test_felt_feed_accepts_hemisphere_fallback_when_coordinates_missing(app):
    event = earthquake()
    event.pop("Coordinates")
    with app.app_context():
        service = BMKGRealtimeService(
            fetcher=lambda _url: {"Infogempa": {"gempa": [event]}}
        )
        result = service.get_felt()
    assert result["earthquakes"][0]["latitude"] == -6.2
    assert result["earthquakes"][0]["longitude"] == 106.8


def test_fetch_uses_bmkg_headers_and_parses_utf8_json(app, monkeypatch):
    captured = {}

    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return False

        def read(self, _limit):
            return json.dumps(latest_payload()).encode("utf-8")

    def fake_urlopen(request, timeout):
        captured["headers"] = dict(request.header_items())
        captured["url"] = request.full_url
        captured["timeout"] = timeout
        return FakeResponse()

    monkeypatch.setattr(bmkg_module, "urlopen", fake_urlopen)
    with app.app_context():
        service = BMKGRealtimeService()
        result = service._fetch_json(
            "https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json"
        )

    headers = {key.lower(): value for key, value in captured["headers"].items()}
    assert headers["user-agent"] == "UnitTest-WebGIS/1.0"
    assert headers["referer"] == "https://www.bmkg.go.id/"
    assert headers["origin"] == "https://www.bmkg.go.id"
    assert "application/json" in headers["accept"]
    assert result["Infogempa"]["gempa"]["Magnitude"] == "4.8"


def test_http_403_is_logged_and_raised_as_safe_service_error(app, monkeypatch):
    def forbidden(_request, timeout):
        raise HTTPError(
            "https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json",
            403,
            "Forbidden",
            None,
            BytesIO(b"blocked"),
        )

    monkeypatch.setattr(bmkg_module, "urlopen", forbidden)
    with app.app_context():
        service = BMKGRealtimeService()
        with pytest.raises(BMKGRealtimeError, match="HTTP 403"):
            service._fetch_json(
                "https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json"
            )


def test_stale_cache_is_returned_when_provider_fails(app):
    with app.app_context():
        service = BMKGRealtimeService(fetcher=lambda _url: latest_payload())
        initial = service.get_latest()
        service.fetcher = lambda _url: (_ for _ in ()).throw(
            BMKGRealtimeError("upstream down")
        )
        app.extensions["redis"].delete(service._cache_key("latest", "fresh"))
        stale = service.get_latest()

    assert initial["cache_status"] == "MISS"
    assert stale["cache_status"] == "STALE"
    assert stale["is_stale"] is True
    assert stale["fetched_at"] == initial["fetched_at"]
    assert stale["warning"]


def test_cache_write_failure_does_not_discard_live_bmkg_payload(app):
    app.extensions["redis"].fail_writes = True
    with app.app_context():
        service = BMKGRealtimeService(fetcher=lambda _url: latest_payload())
        result = service.get_latest()

    assert result["earthquake"]["magnitude"] == 4.8
    assert result["cache_status"] == "MISS"


def test_service_can_fetch_without_redis(app):
    app.extensions.pop("redis", None)
    with app.app_context():
        service = BMKGRealtimeService(fetcher=lambda _url: latest_payload())
        result = service.get_latest()
    assert result["earthquake"]["magnitude"] == 4.8


def test_invalid_coordinate_payload_is_rejected(app):
    payload = latest_payload()
    payload["Infogempa"]["gempa"]["Coordinates"] = "120,999"
    with app.app_context():
        service = BMKGRealtimeService(fetcher=lambda _url: payload)
        with pytest.raises(BMKGRealtimeError):
            service.get_latest()


def test_malformed_provider_payload_fails_closed(app):
    with app.app_context():
        service = BMKGRealtimeService(fetcher=lambda _url: {"unexpected": {}})
        with pytest.raises(BMKGRealtimeError):
            service.get_latest()
