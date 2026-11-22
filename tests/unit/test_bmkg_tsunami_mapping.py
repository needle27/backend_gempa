from services.bmkg_realtime_service import BMKGRealtimeService


def test_unknown_potensi_text_is_not_exposed_as_tsunami_status():
    raw = "Gempa ini dirasakan untuk diteruskan pada masyarakat"
    assert BMKGRealtimeService._normalize_tsunami_potential(raw) is None


def test_known_tsunami_values_are_normalized():
    assert (
        BMKGRealtimeService._normalize_tsunami_potential("Tidak berpotensi tsunami")
        == "Tidak berpotensi tsunami"
    )
    assert (
        BMKGRealtimeService._normalize_tsunami_potential("Berpotensi tsunami")
        == "Berpotensi tsunami"
    )


def test_unknown_tsunami_text_is_preserved_only_as_raw_value():
    raw = "Gempa ini dirasakan untuk diteruskan pada masyarakat"
    item = {
        "Tanggal": "15 Nov 2026",
        "Jam": "04:24:20 WIB",
        "DateTime": "2026-11-14T21:24:20+00:00",
        "Coordinates": "-8.1,120.49",
        "Lintang": "8.10 LS",
        "Bujur": "120.49 BT",
        "Magnitude": "4.5",
        "Kedalaman": "2 km",
        "Wilayah": "Utara Ruteng",
        "Potensi": raw,
        "Dirasakan": "II Manggarai",
    }
    normalized = BMKGRealtimeService._normalize_earthquake(item)
    assert normalized["tsunami_potential"] is None
    assert normalized["tsunami_potential_raw"] == raw
