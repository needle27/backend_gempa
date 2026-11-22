# SEISMAP v0.4.1 — Integrasi Kontrak BE 4.1

Versi frontend: `0.4.1`  
Kontrak acuan: `BE_4.1_FINAL_DOCS_OVERLAY.zip`  
Base URL lokal: `http://127.0.0.1:5000`

## Perubahan implementasi

- Pembaruan kontrak Final DBSCAN: request hanya berisi `experiment_id`; threshold kedalaman dihapus dari UI dan payload.

- Nama cookie CSRF default mengikuti BE 4.1: `csrf_access_token` dan `csrf_refresh_token`.
- Semua request menggunakan `credentials: include`; JWT tidak disimpan di localStorage.
- Request mutasi selain login memerlukan cookie CSRF yang dapat dibaca browser dan mengirim `X-CSRF-TOKEN`.
- Parser error menerima envelope `data/meta` dan fallback JWT `{"msg":"..."}`.
- `X-Request-ID` dari response disimpan pada `ApiError.requestId` untuk debugging.
- Login mengirim email atau username + password, kemudian memverifikasi sesi melalui `GET /api/auth/me`.
- Refresh menggunakan `csrf_refresh_token`; logout menggunakan `csrf_access_token`.
- Ditambahkan dry-run `POST /api/admin/datasets/validate`.
- Ditambahkan detail dataset, detail run, dan daftar Audit Log dengan filter/pagination.
- Parameter Search mendukung `min_samples_candidates` wajib, `sensitivity_percentages` opsional, dan `eps_candidates_km` opsional.
- Final DBSCAN mengirim hanya `experiment_id`; epsilon dan MinPts diwarisi dari eksperimen terpilih. Tidak ada input atau payload threshold kedalaman.
- Public WebGIS menampilkan pesan yang sesuai ketika belum ada run aktif (404 `NOT_FOUND`).
- BMKG tetap melalui tiga endpoint read-only backend dan feed stale ditandai pada UI.

## Environment

```env
VITE_API_BASE_URL=http://127.0.0.1:5000
VITE_UI_PREVIEW_MODE=false
VITE_CSRF_COOKIE_NAME=csrf_access_token
VITE_CSRF_REFRESH_COOKIE_NAME=csrf_refresh_token
```

Untuk preview visual lokal, jalankan `npm run dev:preview`. Semua operasi mutasi tetap dinonaktifkan. Preview fixtures diberi label `Data Simulasi`.

**Penting untuk cookie dev:** kontrak backend memakai `JWT_COOKIE_SAMESITE=Lax`. Samakan hostname frontend dan API agar cookie dikirim pada fetch. Dengan `VITE_API_BASE_URL=http://127.0.0.1:5000`, buka frontend melalui `http://127.0.0.1:5173` dan set `FRONTEND_ORIGIN=http://127.0.0.1:5173`. Jika memilih `localhost`, gunakan `localhost` untuk keduanya dan cocokkan `FRONTEND_ORIGIN`. Hindari mencampur `localhost` dengan `127.0.0.1`; keduanya dapat dianggap site berbeda oleh browser. Verifikasi cookie CSRF dapat dibaca dari halaman admin sebelum menguji operasi mutasi.

## Endpoint yang dipakai

### Authentication

- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### Admin

- `GET /api/admin/datasets?page=1&limit=20`
- `GET /api/admin/datasets/{dataset_id}`
- `POST /api/admin/datasets/validate` (multipart `file`)
- `POST /api/admin/datasets` (multipart `file`, `dataset_name`, `source_name`, optional `source_url`, `preprocessing_version`)
- `POST /api/admin/datasets/{dataset_id}/parameter-search`
- `GET /api/admin/jobs/{job_id}`
- `GET /api/admin/jobs/{job_id}/experiments`
- `POST /api/admin/datasets/{dataset_id}/runs`
- `GET /api/admin/datasets/{dataset_id}/runs` (maksimum 200, tanpa pagination)
- `GET /api/admin/runs/{run_id}`
- `POST /api/admin/runs/{run_id}/activate`
- `GET /api/admin/audit-logs` (filter dan pagination)

### Public

- `GET /api/metadata`
- `GET /api/summary`
- `GET /api/profil`
- `GET /api/gempa?page=1&limit=1000`
- `GET /api/realtime/latest`
- `GET /api/realtime/m5`
- `GET /api/realtime/felt`

## Batas kontrak yang masih perlu dikonfirmasi

OpenAPI BE 4.1 mendefinisikan response umum `SuccessEnvelope` dengan `data` bertipe bebas. Karena itu, beberapa bentuk record belum dapat diturunkan dari OpenAPI saja:

1. Struktur `data` untuk Audit Log. Implementasi frontend saat ini mengharapkan `data` berupa array record dan `meta.count/limit/offset` untuk pagination. Jika response runtime berbeda, sesuaikan adapter berdasarkan response aktual.
2. Struktur detail dataset dan detail run. Frontend menampilkan payload JSON apa adanya sampai serializer final dikonfirmasi.
3. Struktur detail response `/api/auth/me`. Normalizer mendukung `data` langsung atau `data.user` untuk kompatibilitas; sesi tetap diverifikasi dengan endpoint `/me` setelah login.

Jangan mengisi gap ini dengan data buatan. Jika response runtime berbeda dari asumsi di atas, ambil contoh response aktual dari Postman/server dan ubah adapter frontend.

## Aturan penting BE 4.1

- DBSCAN Final hanya memakai latitude dan longitude dengan metric Haversine. Epsilon dan MinPts berasal dari eksperimen terpilih.
- Profil kedalaman tetap ditampilkan dari `/api/profil`: `avg_depth`, `min_depth`, `max_depth`, `shallow_event_count`, `medium_event_count`, dan `deep_event_count`. Kategori: dangkal 0–<70 km, menengah 70–<300 km, dalam >=300 km.

- Dry-run validasi mengembalikan `valid=true`, `persisted=false` saat berhasil; audit event tetap dicatat.
- Header CSV wajib memuat `event_id,tanggal,latitude,longitude,magnitude,kedalaman,lokasi`; nilai kolom `lokasi` boleh kosong.
- `tanggal` wajib ISO-8601 dengan timezone/offset.
- Periode 2021-01-01 sampai 2025-12-31; latitude -15 sampai 10; longitude 90 sampai 145.
- Kedalaman boleh kosong; jika ada harus finite dan tidak negatif.
- Parameter Search menerima MinPts integer >= 2. Epsilon boleh dihitung dari k-distance/knee jika `eps_candidates_km` tidak diberikan.
- Jika knee tidak ditemukan, backend dapat menggagalkan job; frontend tidak membuat epsilon pengganti.
- Final DBSCAN: `POST /api/admin/datasets/{dataset_id}/runs` dengan body `{"experiment_id": <id>}` saja. Kedalaman dipakai untuk profiling pascaklasterisasi, bukan sebagai fitur atau filter DBSCAN.
- HTTP 202 berarti job dijadwalkan, bukan selesai.
- `/api/metadata`, `/api/summary`, `/api/profil`, `/api/gempa` memerlukan run aktif; 404 sebelum aktivasi adalah kondisi yang diharapkan.
- `meta.count` pada Audit Log adalah total hasil filter. Pada beberapa list lain, count hanya jumlah item yang dikembalikan.
- BMKG realtime read-only, rate limit 20 request/menit/IP. Jika `is_stale=true`, UI wajib memberi label data stale.

## Verifikasi

Paket ini telah diperiksa secara statis. Runtime integration tetap perlu diuji terhadap backend BE 4.1 yang berjalan, terutama:

- cookie CSRF terbaca di browser dan header `X-CSRF-TOKEN` diterima;
- bentuk payload `GET /api/auth/me`;
- response array dan meta Audit Log;
- serializer detail dataset dan detail run;
- endpoint public saat run aktif dan saat belum ada run aktif;
- upload/validasi CSV dan polling job.
