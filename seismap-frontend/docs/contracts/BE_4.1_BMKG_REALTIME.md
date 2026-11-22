# BMKG Realtime Integration

## 1. Sumber resmi yang digunakan source

Service `services/bmkg_realtime_service.py` mengambil JSON dari:

| API backend | URL sumber BMKG |
|---|---|
| `GET /api/realtime/latest` | `https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json` |
| `GET /api/realtime/m5` | `https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json` |
| `GET /api/realtime/felt` | `https://data.bmkg.go.id/DataMKG/TEWS/gempadirasakan.json` |

Halaman referensi: `https://www.bmkg.go.id/`.

Shakemap, jika nama file tersedia dan lolos validasi, dibentuk di bawah `https://static.bmkg.go.id/`.

## 2. Sifat integrasi

- Read-only adapter.
- Tidak memasukkan feed realtime ke dataset penelitian atau tabel DBSCAN.
- Mengirim Accept, Accept-Language, User-Agent, Referer, Origin, dan cache-control headers.
- Timeout default dari config 8 detik.
- Maksimum body upstream 2 MiB.
- Redis cache digunakan jika tersedia.
- Fresh cache minimal 60 detik.
- Stale cache default 86400 detik.
- Cache outage tidak otomatis menghentikan pengambilan langsung dari BMKG.
- Jika upstream gagal dan stale cache ada, data stale dapat dikembalikan dengan `is_stale=true` dan warning.
- Jika upstream gagal dan tidak ada stale cache, backend mengembalikan HTTP 503.
- Tiap route dibatasi 20 request/menit/IP.

## 3. Normalisasi data

`data` mengandung:
- `earthquakes`: array event ternormalisasi.
- `count`: jumlah event.
- `earthquake`: event tunggal tambahan untuk kategori `latest`.
- `source`, `source_name`, `source_url`, `category`.
- `fetched_at`, `cache_status`, `is_stale`, `warning`, `cache_ttl_seconds`.

Setiap event dapat berisi:
- `event_time_utc`
- `date_local`, `time_local`
- `magnitude`, `depth_km`
- `latitude`, `longitude`, `coordinates`
- `latitude_label`, `longitude_label`, `depth_label`
- `region`
- `tsunami_potential`, `tsunami_potential_raw`
- `felt`
- `shakemap_url`

Koordinat diprioritaskan dari `Coordinates`; fallback menggunakan label Lintang/Bujur dengan arah mata angin. Kedalaman boleh null. Teks Potensi yang tidak dikenali tidak dipetakan menjadi status tsunami positif; teks asli dipertahankan pada `tsunami_potential_raw`.

## 4. Cache status

| `cache_status` | Arti |
|---|---|
| `MISS` | Data baru diambil dari upstream |
| `HIT` | Data diambil dari fresh cache |
| `STALE` | Upstream gagal; data lama dipakai dari stale cache |

Jika `is_stale=true`, UI harus menampilkan label bahwa data bukan pembaruan realtime terbaru. Jangan menyamarkan stale cache sebagai data live.

## 5. Kegagalan upstream

HTTP 503 dari backend dapat berarti BMKG menolak request, timeout, payload berubah, JSON tidak valid, atau tidak tersedia stale cache. Detail upstream sengaja tidak diekspos pada response publik; periksa log backend menggunakan request correlation dan log event `bmkg_realtime_*`.

Ketersediaan BMKG merupakan dependency eksternal dan dapat berubah. Unit test service tidak menjamin feed upstream selalu dapat diakses.
