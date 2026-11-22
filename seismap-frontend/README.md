# SEISMAP — Frontend

React + Vite + TypeScript frontend untuk **SEISMAP — Pemetaan dan Analisis Gempa Indonesia**. Backend dikembangkan dan dijalankan secara terpisah.

## Run

```bash
npm install
npm run dev:preview
```

`dev:preview` loads `.env.preview` and enables UI-only preview. Fixture data is marked **Data Simulasi**; admin mutations and login requests are disabled. To run against Flask:

```bash
cp .env.example .env.local
# Set VITE_UI_PREVIEW_MODE=false and the actual backend origin
npm run dev
```

Production build always disables preview mode:

```bash
npm run build
npm run preview
```

## Routes

**Public**
- `/` — Sorotan
- `/peta-klaster` — Peta Klaster (`/webgis` redirects here)
- `/analisis` — Analisis
- `/gempa-terkini` — Gempa Terkini BMKG (`/gempa-realtime` redirects here)

**Admin**
- `/admin/login` — Masuk Admin
- `/admin` — Dasbor
- `/admin/dataset` — Dataset
- `/admin/validasi` — Validasi
- `/admin/parameter` — Pencarian Parameter
- `/admin/jobs` — Manajemen Proses untuk memantau proses dan membuka kembali hasil eksperimen
- `/admin/dbscan-final` — DBSCAN Final
- `/admin/riwayat-run` — Riwayat Eksekusi
- `/admin/audit-log` — Log Aktivitas dengan filter dan pembagian halaman.

## Standar Bahasa Antarmuka

Bahasa Indonesia digunakan sebagai bahasa utama pada halaman publik dan admin. Istilah teknis yang lazim—seperti DBSCAN, Haversine, KNN, Epsilon, MinPts, Noise, Silhouette Score, Dataset, CSV, API, dan WebGIS—dipertahankan jika membantu ketepatan makna. Respons API dan objek JSON tidak ditampilkan mentah; rincian disajikan sebagai informasi berlabel. Panduan lengkap tersedia pada `docs/UI_LANGUAGE_GUIDE.md`.

## Environment

```env
VITE_API_BASE_URL=http://127.0.0.1:5000
VITE_UI_PREVIEW_MODE=false
VITE_CSRF_COOKIE_NAME=csrf_access_token
VITE_CSRF_REFRESH_COOKIE_NAME=csrf_refresh_token
```

CSRF cookie defaults mengikuti kontrak BE 4.1 (`csrf_access_token`, `csrf_refresh_token`). Jangan masukkan secret atau JWT ke variabel `VITE_`. Request memakai `credentials: include`; JWT tidak disimpan di localStorage.

Untuk development dengan `JWT_COOKIE_SAMESITE=Lax`, samakan hostname browser dan API. Dengan base URL `127.0.0.1`, buka frontend di `http://127.0.0.1:5173` dan cocokkan `FRONTEND_ORIGIN` backend. Jangan campur `localhost` dan `127.0.0.1`.

## Architecture

```text
src/
├── api/          # Central HTTP client, auth and endpoint services
├── components/   # Reusable UI, charts and Leaflet map
├── config/       # Environment flags
├── context/      # Auth and pipeline UI state
├── hooks/        # Resource loading and job polling
├── layouts/      # Public and Admin layouts
├── mocks/        # Preview-only fixture data, dynamically imported
├── pages/        # Public and Admin pages
├── styles/       # Glassmorphism and Leaflet styles
└── types/        # API and domain contracts
```


## Public information content (v0.3.0, retained in v0.4.0)

Public pages include explanatory content so visitors can understand the research even when no active backend run is available:

- **Sorotan:** research scope (2021–2025; latitude -15 to 10; longitude 90 to 145), clustering attributes, workflow, interpretation of cluster/noise, and separation of research from BMKG realtime.
- **Peta Klaster:** map-reading guide, cluster/noise legend, research bounds, active-run summary, and event details in marker tooltips.
- **Analisis:** DBSCAN parameter explanations (epsilon, Min Samples, Haversine), profile interpretation, evaluation context, and profile table fields.
- **Gempa Terkini:** explanation of latest, M5.0+, and felt feeds; reading event details; source attribution; and separation from DBSCAN research data.

All research figures continue to come from backend responses. Preview fixtures remain labelled **Data Simulasi** and must not be interpreted as actual research findings.

## Final DBSCAN contract update (v0.4.1)

Final run creation uses `POST /api/admin/datasets/{dataset_id}/runs` with only `{"experiment_id": <id>}`. The selected experiment supplies epsilon and MinPts. No depth threshold is requested or sent. Depth remains a post-clustering profile attribute and is displayed through `avg_depth`, `min_depth`, `max_depth`, `shallow_event_count`, `medium_event_count`, and `deep_event_count`.

## API mapping

- Auth: login, refresh, logout, me; cookie JWT + CSRF header.
- Dataset: list, detail, upload, dry-run validation.
- Processing: parameter search, job polling, experiments.
- DBSCAN: create final run, run history, run detail, activate.
- Audit: list with supported filters and pagination.
- Public: metadata, summary, cluster profiles, earthquake points.
- BMKG: latest, M5+, felt via read-only Flask proxy.

Detail payloads dan serializer Audit Log masih perlu dicocokkan dengan response runtime karena OpenAPI BE 4.1 memakai `data` generik pada beberapa endpoint. Rincian integrasi dan batas kontrak ada di `docs/BE41_INTEGRATION.md`. BMKG data tetap terpisah dari dataset penelitian DBSCAN.

## Important boundaries

- Frontend does not run preprocessing, DBSCAN, parameter search, evaluation, or database writes itself.
- DBSCAN uses latitude/longitude with Haversine; magnitude, depth, time, and location are profile attributes only.
- Noise is `cluster_id = -1` or `is_noise = true`.
- Public WebGIS reads the globally active `SUCCESS` run only.
- Realtime BMKG is a separate read-only information page; it is never merged with research data.
- No mock is used when preview mode is off. Missing/unavailable endpoints show loading, empty, or error states.
- No success state is shown before backend confirmation. HTTP 202 means a job was accepted, not completed.
- Backend is the source of truth for validation, authorization, job status, clustering and activation.


## BE 4.1 Integration (v0.4.1)

Lihat [`docs/BE41_INTEGRATION.md`](docs/BE41_INTEGRATION.md) for endpoint mapping, CSRF rules, validation semantics, parameter-search payloads, active-run behavior, and remaining response-shape checks.


## Job Management (v0.4.2)

Halaman Admin `/admin/jobs` memakai endpoint `GET /api/admin/jobs` dengan query `page`, `limit`, `status`, `job_type`, dan `dataset_id`. Detail job memakai `GET /api/admin/jobs/{job_id}`; hasil Parameter Search memakai `GET /api/admin/jobs/{job_id}/experiments`. Job yang sudah `SUCCESS` dapat dibuka kembali dari halaman ini dan eksperimennya diteruskan ke DBSCAN Final tanpa menjalankan Parameter Search ulang.

Filter dan pagination dikirim ke backend. Daftar job yang memiliki status `QUEUED` atau `RUNNING` diperbarui otomatis setiap 5 detik. Pilihan dataset dan job Parameter Search disimpan dalam `sessionStorage` agar tetap tersedia setelah refresh pada tab browser yang sama.


## Final DBSCAN workflow refinement (v0.4.3)

- Job sumber diverifikasi melalui `GET /api/admin/jobs/{job_id}` sebelum eksperimen digunakan.
- Final DBSCAN hanya menerima eksperimen `VALID` dari job `PARAMETER_SEARCH` berstatus `SUCCESS` dan dataset yang sama.
- Mengganti dataset akan menghapus referensi job Parameter Search sebelumnya agar eksperimen lintas dataset tidak dapat tertukar.
- Ringkasan eksperimen menampilkan epsilon, MinPts, jumlah klaster, noise, dan Silhouette sebelum run dibuat.
- ID job Final DBSCAN dan run terkait disimpan di `sessionStorage` untuk memulihkan pemantauan setelah refresh pada tab yang sama.
- Sebelum submit, frontend memeriksa job Final Clustering `QUEUED`/`RUNNING` pada dataset yang sama dan memulihkan job aktif yang sudah ada. Konflik HTTP 409 dengan `job_id` juga dipulihkan, bukan dikirim ulang.
- Kontrak request final tetap `POST /api/admin/datasets/{dataset_id}/runs` dengan body hanya `experiment_id`; tidak ada threshold kedalaman.

## DBSCAN Parameter Analysis — K-Distance & Elbow (v0.4.7)

Halaman Admin `/admin/parameter` menampilkan analisis K-Distance setelah job `PARAMETER_SEARCH` berstatus `SUCCESS`. Comparison View mengambil ringkasan `GET /api/admin/jobs/{job_id}/elbow`, lalu memuat `preview_points` setiap kandidat melalui `detail_url` yang disediakan backend. Detail View menampilkan kurva MinPts terpilih, status Knee, epsilon, dan eksperimen DBSCAN yang diuji pada MinPts yang sama.

Unduhan PNG, CSV, dan JSON menggunakan URL artefak yang dikembalikan backend. Request artefak memakai cookie JWT (`credentials: include`) dan mencoba refresh sesi satu kali jika menerima HTTP 401. Job historis tanpa artefak menampilkan status bahwa grafik belum tersedia.

Frontend tidak menghitung ulang KNN, Knee, epsilon, atau DBSCAN. Backend tetap menjadi sumber perhitungan ilmiah; frontend hanya menyajikan preview dan metadata. Final DBSCAN tidak berubah dan tetap mengirim `{ "experiment_id": ... }`. Lihat `docs/ELBOW_ANALYSIS_FE_HANDOFF.md` untuk kontrak backend.

## Chart hover & text containment (v0.4.6)

All Recharts visualizations use a compact shared Glassmorphism tooltip. The default grey hover cursor is disabled, chart marks retain their semantic colors, and missing profile metrics remain displayed as unavailable rather than being represented as zero. Map marker tooltips wrap long location names and event identifiers. Common page/card content has safe flex/grid sizing and text wrapping to reduce text extending outside its container. Wide tables keep their intentional contained horizontal scrolling. See `docs/CHART_TOOLTIP_AND_LAYOUT_AUDIT.md` for the manual browser QA checklist.

## Job Lifecycle Control (v0.4.8)

Panel kendali proses tersedia pada Pencarian Parameter, DBSCAN Final, dan Manajemen Proses:

- `QUEUED` / `RUNNING`: Jeda Proses dan Hentikan Proses.
- `PAUSE_REQUESTED`: menunggu checkpoint aman; status belum dianggap dijeda.
- `PAUSED`: Lanjutkan atau Hentikan Proses.
- `STOP_REQUESTED`: menunggu penghentian aman.
- `FAILED` / `CANCELLED`: Mulai Ulang sebagai Job baru jika backend mengizinkan.
- `SUCCESS`: tidak menampilkan kontrol lifecycle.

Resume mempertahankan Job ID yang sama. Restart menggunakan ID baru dan mempertahankan relasi ke Job sebelumnya melalui `parent_job_id`. Semua aksi memakai cookie JWT dan CSRF dari API client; request lifecycle dikirim tanpa body. Rincian implementasi dan checklist tersedia pada `docs/contracts/FRONTEND_JOB_LIFECYCLE_HANDOFF.md` dan `docs/FRONTEND_JOB_LIFECYCLE_QA.md`.
