# API Verification Report — BE 4.1

Tanggal catatan pengujian lokal: 15 November 2026 (berdasarkan output terminal yang dibagikan pada proyek).

## 1. Ringkasan bukti

| Area | Bukti yang tersedia | Hasil |
|---|---|---|
| Full pytest | `python -m pytest -q` | 60 passed |
| BMKG service + tsunami + admin support targeted tests | Tiga file test | 20 passed |
| Route inventory | `flask --app app routes` | Route utama terdaftar |
| Flask liveness | `GET /api/health` | HTTP 200 |
| Readiness | `GET /api/health/ready` | HTTP 200; PostgreSQL dan Redis `ok` |
| Redis | `redis-cli ping` | PONG |
| Celery worker | `celery inspect ping` | 1 node online, pong |
| Dataset detail | Authenticated GET | HTTP 200 |
| Run detail | Authenticated GET | HTTP 200 |
| Audit log list | Authenticated GET | HTTP 200 |
| Dataset duplicate guard | Dry-run file hash sama | HTTP 409 `DUPLICATE_DATASET_FILE` |
| Dataset dry-run valid | Temporary CSV copy, 59.847 baris | HTTP 200, valid true |
| Dry-run persistence | `persisted=false`, dataset count 1 -> 1 | Tidak membuat dataset baru |
| Audit log filter/pagination | 12 assertion checks | 12/12 pass |
| Public WebGIS | metadata, summary, profil, gempa setelah run aktif | HTTP 200 pada keempat endpoint |

Jumlah 60 test function juga ditemukan pada source tree yang diunggah (28 unit, 17 integration, 15 service-functional). Hasil pytest di atas berasal dari output terminal lokal pengguna, bukan eksekusi ulang di lingkungan pembuat dokumen.

## 2. Run aktif yang dilaporkan pada lingkungan lokal

| Field | Nilai |
|---|---:|
| Dataset ID | 1 |
| Run ID | 1 |
| Total points | 59.847 |
| Metric | Haversine |
| Epsilon | 70,031682093859 km |
| Min samples | 20 |
| Cluster count | 2 |
| Noise count | 378 |
| Noise percentage | 0,6316106070479723% |
| Silhouette | 0,4492785917113849 |
| Status | SUCCESS |
| Active | true |

Nilai di atas adalah snapshot database pengguna pada saat pengujian; bukan konstanta algoritma atau nilai yang harus dipakai pada instalasi lain.

## 3. Dataset validation

File bersih yang diduplikasi untuk dry-run memiliki 59.847 baris. File asli tidak diubah. Hasil dry-run:
- HTTP 200.
- `valid=true`.
- `persisted=false`.
- `row_count=59847`.
- dataset count sebelum dan sesudah tetap 1.

Percobaan file dengan SHA-256 yang sama menghasilkan HTTP 409 dan `existing_dataset_id=1`. Perilaku ini sesuai dengan duplicate protection.

## 4. Audit Log

Dua halaman pagination dengan limit 2 mengembalikan offset 0 dan 2 serta ID record yang tidak tumpang tindih. Filter action, entity type, entity ID, user ID, pencarian teks, dan rentang tanggal merespons HTTP 200. Validasi page 0, limit 201, dan reversed date range merespons HTTP 422. Total assertion yang dilaporkan: 12/12 pass.

## 5. Batas bukti

- Laporan ini bukan penetration test atau load test.
- Belum ada bukti deployment production.
- Ketersediaan upstream BMKG berubah dari waktu ke waktu; source mengarah ke URL resmi BMKG dan unit tests service lulus, tetapi laporan ini tidak menjamin upstream selalu merespons 200.
- `dbcv_score` dan `stability_score` dapat null pada implementasi yang diperiksa.
- OpenAPI dan Postman yang disertakan merupakan dokumentasi hasil pemetaan source; belum ada hasil contract-test otomatis yang membuktikan seluruh schema OpenAPI identik dengan runtime.
- Catatan historis: laporan ini mendahului pembaruan kontrak Final DBSCAN. Kontrak frontend terbaru hanya mengirim `experiment_id`; tidak ada threshold kedalaman pada request final run.

## 6. Kesimpulan

Bukti lokal menunjukkan jalur utama backend telah berjalan: health/readiness, autentikasi admin, validasi dataset, parameter search, final clustering, aktivasi run, API publik WebGIS, BMKG service tests, dan audit log. Finalisasi production tetap memerlukan pengujian deployment, secret, HTTPS, CORS origin production, backup/restore, dan monitoring.
