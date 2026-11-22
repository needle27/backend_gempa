"""Read-only adapter for BMKG's public earthquake JSON feeds.

The service fetches the official BMKG feeds, normalizes their payloads, and
uses the application's Redis extension as an optional shared cache. It never
writes realtime events into the research dataset or database tables.
"""
from __future__ import annotations

import json
import math
import os
import re
import time
from datetime import datetime, timezone
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin
from urllib.request import Request, urlopen

from flask import current_app
from redis.exceptions import RedisError


BMKG_SOURCE_NAME = "Badan Meteorologi, Klimatologi, dan Geofisika"
BMKG_SOURCE_PAGE = "https://www.bmkg.go.id/"
BMKG_BASE_URL = "https://data.bmkg.go.id/DataMKG/TEWS/"
BMKG_ENDPOINTS = {
    "latest": "autogempa.json",
    "m5": "gempaterkini.json",
    "felt": "gempadirasakan.json",
}
BMKG_SHAKEMAP_BASE_URL = "https://static.bmkg.go.id/"
MAX_RESPONSE_BYTES = 2 * 1024 * 1024


class BMKGRealtimeError(RuntimeError):
    """Expected upstream/cache error safe to expose as a generic 503."""


class BMKGRealtimeService:
    """Fetch, normalize, and cache BMKG's three public earthquake feeds."""

    def __init__(self, *, redis_client=None, fetcher=None):
        self.redis = (
            redis_client
            if redis_client is not None
            else current_app.extensions.get("redis")
        )
        self.fetcher = fetcher or self._fetch_json

    @staticmethod
    def _setting(name: str, default):
        """Read an environment override first, then Flask config."""
        value = os.getenv(name)
        if value is not None and value != "":
            return value
        return current_app.config.get(name, default)

    def get_latest(self) -> dict:
        return self._get_feed("latest")

    def get_m5(self) -> dict:
        return self._get_feed("m5")

    def get_felt(self) -> dict:
        return self._get_feed("felt")

    @staticmethod
    def _utc_now() -> str:
        return datetime.now(timezone.utc).isoformat(timespec="seconds").replace(
            "+00:00", "Z"
        )

    @staticmethod
    def _cache_key(category: str, kind: str) -> str:
        # Keep the namespace product-neutral; do not reuse keys from older apps.
        return f"webgis:bmkg:realtime:{category}:{kind}"

    def _cache_ttl(self) -> int:
        # Keep upstream requests below BMKG's published request ceiling.
        configured = int(self._setting("BMKG_CACHE_SECONDS", 60))
        return max(configured, 60)

    def _stale_ttl(self) -> int:
        configured = int(self._setting("BMKG_STALE_SECONDS", 86400))
        return max(configured, self._cache_ttl())

    def _timeout(self) -> float:
        return max(float(self._setting("BMKG_TIMEOUT_SECONDS", 10)), 1.0)

    def _request_headers(self) -> dict:
        user_agent = str(
            self._setting("BMKG_USER_AGENT", "Mozilla/5.0 WebGIS-BMKG-Client/1.0")
        )
        referer = str(self._setting("BMKG_REFERER", BMKG_SOURCE_PAGE))
        return {
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
            "User-Agent": user_agent,
            "Referer": referer,
            "Origin": "https://www.bmkg.go.id",
            "Cache-Control": "no-cache",
            "Pragma": "no-cache",
        }

    def _fetch_json(self, url: str):
        request = Request(url, headers=self._request_headers(), method="GET")
        try:
            with urlopen(request, timeout=self._timeout()) as response:
                body = response.read(MAX_RESPONSE_BYTES + 1)
                if len(body) > MAX_RESPONSE_BYTES:
                    raise BMKGRealtimeError(
                        "Respons BMKG melebihi batas ukuran yang diizinkan."
                    )
                payload = json.loads(body.decode("utf-8-sig"))
                if not isinstance(payload, dict):
                    raise BMKGRealtimeError(
                        "Format respons BMKG bukan objek JSON."
                    )
                return payload
        except BMKGRealtimeError:
            raise
        except HTTPError as exc:
            # Record the real upstream status in server logs, not in public JSON.
            current_app.logger.warning(
                "bmkg_realtime_upstream_http_error",
                extra={
                    "url": url,
                    "upstream_status": exc.code,
                    "content_type": exc.headers.get("Content-Type") if exc.headers else None,
                    "retry_after": exc.headers.get("Retry-After") if exc.headers else None,
                },
            )
            raise BMKGRealtimeError(
                f"BMKG menolak permintaan atau mengembalikan HTTP {exc.code}."
            ) from exc
        except (URLError, TimeoutError, OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
            current_app.logger.warning(
                "bmkg_realtime_upstream_failed",
                extra={"url": url, "error_type": type(exc).__name__},
            )
            raise BMKGRealtimeError(
                "Sumber data BMKG sementara tidak dapat diakses."
            ) from exc

    def _read_cache(self, category: str, kind: str):
        if self.redis is None:
            return None
        key = self._cache_key(category, kind)
        try:
            raw = self.redis.get(key)
        except RedisError:
            # Cache outage must not prevent a direct read from BMKG.
            current_app.logger.warning("bmkg_realtime_cache_read_failed", exc_info=True)
            return None
        if raw is None:
            return None
        try:
            if isinstance(raw, bytes):
                raw = raw.decode("utf-8")
            decoded = json.loads(raw)
            if not isinstance(decoded, dict):
                raise ValueError("Cache payload must be a JSON object.")
            return decoded
        except (UnicodeDecodeError, TypeError, ValueError, json.JSONDecodeError):
            current_app.logger.warning(
                "bmkg_realtime_cache_invalid", extra={"cache_key": key}
            )
            try:
                self.redis.delete(key)
            except RedisError:
                current_app.logger.warning(
                    "bmkg_realtime_invalid_cache_delete_failed", exc_info=True
                )
            return None

    def _write_cache(self, category: str, payload: dict) -> None:
        if self.redis is None:
            return
        serialized = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        try:
            # Cache failure is non-fatal: return the successful live BMKG payload.
            self.redis.setex(
                self._cache_key(category, "stale"), self._stale_ttl(), serialized
            )
            self.redis.setex(
                self._cache_key(category, "fresh"), self._cache_ttl(), serialized
            )
        except RedisError:
            current_app.logger.warning(
                "bmkg_realtime_cache_write_failed", exc_info=True
            )

    @staticmethod
    def _float_value(value):
        if value is None:
            return None
        match = re.search(r"[-+]?\d+(?:[.,]\d+)?", str(value).strip())
        if not match:
            return None
        try:
            number = float(match.group(0).replace(",", "."))
        except ValueError:
            return None
        return number if math.isfinite(number) else None

    @classmethod
    def _hemisphere_value(
        cls, value: str | None, *, negative_tokens: tuple[str, ...]
    ):
        if not value:
            return None
        number = cls._float_value(value)
        if number is None:
            return None
        upper = str(value).upper()
        if any(token in upper for token in negative_tokens):
            return -abs(number)
        if any(token in upper for token in ("LU", "BT")):
            return abs(number)
        return None

    @classmethod
    def _coordinates(cls, item: dict):
        raw = item.get("Coordinates") or item.get("coordinates")
        latitude = longitude = None
        if isinstance(raw, str):
            parts = [part.strip() for part in raw.split(",")]
            if len(parts) == 2:
                latitude = cls._float_value(parts[0])
                longitude = cls._float_value(parts[1])
        elif isinstance(raw, (list, tuple)) and len(raw) == 2:
            latitude = cls._float_value(raw[0])
            longitude = cls._float_value(raw[1])

        if latitude is None:
            latitude = cls._hemisphere_value(
                item.get("Lintang"), negative_tokens=("LS",)
            )
        if longitude is None:
            longitude = cls._hemisphere_value(
                item.get("Bujur"), negative_tokens=("BB",)
            )
        if latitude is None or longitude is None:
            raise BMKGRealtimeError("Format koordinat dari BMKG tidak dikenali.")
        if not -90 <= latitude <= 90 or not -180 <= longitude <= 180:
            raise BMKGRealtimeError(
                "Koordinat dari BMKG berada di luar rentang geografis."
            )
        return latitude, longitude

    @staticmethod
    def _shakemap_url(filename):
        if not filename:
            return None
        name = str(filename).strip().replace("\\", "/").split("/")[-1]
        if not name or not re.fullmatch(r"[A-Za-z0-9_.-]+", name):
            return None
        return urljoin(BMKG_SHAKEMAP_BASE_URL, name)

    @staticmethod
    def _normalize_tsunami_potential(value):
        if value is None:
            return None
        raw = " ".join(str(value).strip().split())
        lowered = raw.casefold()
        if "tidak berpotensi tsunami" in lowered:
            return "Tidak berpotensi tsunami"
        if "berpotensi tsunami" in lowered:
            return "Berpotensi tsunami"
        # Unknown text must never be presented by the UI as a tsunami alert.
        return None

    @classmethod
    def _normalize_earthquake(cls, item: dict) -> dict:
        if not isinstance(item, dict):
            raise BMKGRealtimeError("Format item gempa dari BMKG tidak dikenali.")
        magnitude = cls._float_value(item.get("Magnitude"))
        if magnitude is None or magnitude < 0:
            raise BMKGRealtimeError("Magnitudo dari BMKG tidak valid.")
        latitude, longitude = cls._coordinates(item)
        depth = cls._float_value(item.get("Kedalaman"))
        if depth is not None and depth < 0:
            raise BMKGRealtimeError("Kedalaman dari BMKG tidak valid.")

        return {
            "event_time_utc": item.get("DateTime") or None,
            "date_local": item.get("Tanggal") or None,
            "time_local": item.get("Jam") or None,
            "magnitude": magnitude,
            "depth_km": depth,
            "latitude": latitude,
            "longitude": longitude,
            "coordinates": [latitude, longitude],
            "latitude_label": item.get("Lintang") or None,
            "longitude_label": item.get("Bujur") or None,
            "depth_label": item.get("Kedalaman") or None,
            "region": item.get("Wilayah") or None,
            # BMKG payloads may use the Potensi field for non-tsunami
            # editorial text. Only expose recognized tsunami advisories as a
            # tsunami status; preserve the original source value separately.
            "tsunami_potential": cls._normalize_tsunami_potential(item.get("Potensi")),
            "tsunami_potential_raw": item.get("Potensi") or None,
            "felt": item.get("Dirasakan") or None,
            "shakemap_url": cls._shakemap_url(item.get("Shakemap")),
        }

    def _normalize_feed(self, category: str, raw: dict) -> dict:
        try:
            events = raw["Infogempa"]["gempa"]
        except (TypeError, KeyError) as exc:
            raise BMKGRealtimeError(
                "Struktur respons BMKG berubah atau tidak lengkap."
            ) from exc

        # BMKG's latest feed is normally a single object; list feeds are arrays.
        # Accept either object or array so a valid upstream shape variation does
        # not turn the entire public realtime endpoint into HTTP 503.
        if isinstance(events, dict):
            source_events = [events]
        elif isinstance(events, list):
            source_events = events
        else:
            raise BMKGRealtimeError("Format daftar gempa BMKG tidak dikenali.")

        normalized = [self._normalize_earthquake(item) for item in source_events]
        payload = {
            "earthquakes": normalized,
            "count": len(normalized),
        }
        if category == "latest":
            # Preserve the established singular field while also exposing the
            # full list if BMKG happens to return an array from this feed.
            payload["earthquake"] = normalized[0] if normalized else None

        payload.update(
            {
                "source": "BMKG",
                "source_name": BMKG_SOURCE_NAME,
                "source_url": urljoin(BMKG_BASE_URL, BMKG_ENDPOINTS[category]),
                "category": category,
                "fetched_at": self._utc_now(),
                "cache_status": "MISS",
                "is_stale": False,
                "warning": None,
                "cache_ttl_seconds": self._cache_ttl(),
            }
        )
        return payload

    @staticmethod
    def _with_cache_state(payload: dict, *, status: str, stale: bool = False) -> dict:
        result = dict(payload)
        result["cache_status"] = status
        result["is_stale"] = stale
        if stale:
            result["warning"] = (
                "Sumber BMKG sedang tidak dapat diakses. Data ini berasal dari cache "
                "dan bukan pembaruan realtime terbaru."
            )
        return result

    def _fetch_and_normalize(self, category: str) -> dict:
        url = urljoin(BMKG_BASE_URL, BMKG_ENDPOINTS[category])
        try:
            raw = self.fetcher(url)
            payload = self._normalize_feed(category, raw)
            self._write_cache(category, payload)
            return payload
        except BMKGRealtimeError:
            stale = self._read_cache(category, "stale")
            if stale is not None:
                return self._with_cache_state(stale, status="STALE", stale=True)
            raise

    def _get_feed(self, category: str) -> dict:
        if category not in BMKG_ENDPOINTS:
            raise BMKGRealtimeError("Kategori feed BMKG tidak dikenal.")

        fresh = self._read_cache(category, "fresh")
        if fresh is not None:
            return self._with_cache_state(fresh, status="HIT")

        # If Redis is not configured, serve BMKG directly. The route-level
        # limiter remains active; no local fake data is returned.
        if self.redis is None:
            return self._fetch_and_normalize(category)

        try:
            lock = self.redis.lock(
                self._cache_key(category, "lock"),
                timeout=max(int(self._timeout()) + 10, 15),
                blocking_timeout=max(self._timeout() + 2, 10),
            )
            acquired = lock.acquire(blocking=True)
        except RedisError:
            current_app.logger.warning(
                "bmkg_realtime_cache_lock_failed; fetching upstream without cache lock",
                exc_info=True,
            )
            return self._fetch_and_normalize(category)

        if not acquired:
            # Another request may be refreshing this feed; wait briefly.
            for _ in range(10):
                time.sleep(0.1)
                fresh = self._read_cache(category, "fresh")
                if fresh is not None:
                    return self._with_cache_state(fresh, status="HIT")
            stale = self._read_cache(category, "stale")
            if stale is not None:
                return self._with_cache_state(stale, status="STALE", stale=True)
            raise BMKGRealtimeError(
                "Data realtime sedang diperbarui. Silakan coba kembali."
            )

        try:
            fresh = self._read_cache(category, "fresh")
            if fresh is not None:
                return self._with_cache_state(fresh, status="HIT")
            return self._fetch_and_normalize(category)
        finally:
            try:
                lock.release()
            except RedisError:
                current_app.logger.warning(
                    "bmkg_realtime_cache_lock_release_failed", exc_info=True
                )
