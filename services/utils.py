from datetime import datetime, timezone
import math


EARTH_RADIUS_KM = 6371.0088


def utc_now():
    return datetime.now(timezone.utc)


def finite_float(value, field_name):
    try:
        result = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError(f"{field_name} harus berupa angka.") from exc
    if not math.isfinite(result):
        raise ValueError(f"{field_name} harus berupa angka finite.")
    return result


def parse_aware_datetime(value, field_name="tanggal"):
    if isinstance(value, datetime):
        result = value
    else:
        raw = str(value or "").strip()
        if not raw:
            raise ValueError(f"{field_name} wajib diisi.")
        try:
            result = datetime.fromisoformat(raw.replace("Z", "+00:00"))
        except ValueError as exc:
            raise ValueError(
                f"{field_name} harus menggunakan format ISO-8601 yang valid."
            ) from exc
    if result.tzinfo is None or result.utcoffset() is None:
        raise ValueError(
            f"{field_name} harus memiliki informasi zona waktu; backend tidak menebak zona waktu."
        )
    return result
