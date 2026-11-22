# API Contract — Backend WebGIS Gempa Bumi DBSCAN (BE 4.1)

Base URL lokal: `http://127.0.0.1:5000`

Kontrak ini disusun dari route dan service pada source BE 4.1. Untuk skema mesin, lihat `OPENAPI.yaml`.

## 1. Pola respons

Respons route aplikasi menggunakan envelope:

```json
{
  "data": {},
  "meta": {
    "status": "success"
  }
}
```

Error aplikasi:

```json
{
  "data": null,
  "meta": {
    "status": "error",
    "code": "VALIDATION_ERROR",
    "message": "Pesan kesalahan",
    "details": {}
  }
}
```

List menambahkan `meta.count`, `meta.limit`, dan `meta.offset`. Perhatian: `count` pada Audit Log adalah total record yang cocok dengan filter. Pada beberapa list lain (`/api/admin/datasets`, `/api/gempa`, `/api/profil`, eksperimen, dan riwayat run) `count` adalah jumlah item yang dikembalikan oleh request, bukan total semua halaman.

Header `X-Request-ID` dikembalikan oleh middleware. Client boleh mengirim header tersebut untuk correlation ID yang aman; jika tidak, server membuat ID sendiri.

## 2. Autentikasi dan otorisasi

- Login menerima `email` atau `username` dan `password`.
- Access dan refresh JWT dikelola melalui cookie.
- Cookie utama: `access_token_cookie`, `refresh_token_cookie`.
- CSRF cookie: `csrf_access_token`, `csrf_refresh_token`.
- `JWT_COOKIE_CSRF_PROTECT=True`; request mutasi yang memakai access cookie mengirim `X-CSRF-TOKEN` berisi nilai `csrf_access_token`.
- `/api/auth/refresh` memakai refresh cookie dan nilai `csrf_refresh_token` pada header `X-CSRF-TOKEN`.
- Semua `/api/admin/*` memerlukan JWT access cookie dan role `admin`.
- Endpoint public WebGIS, BMKG, dan health tidak memerlukan login.

Pada konfigurasi cookie JWT, jangan mengirim token melalui localStorage atau menganggap Bearer token sebagai mekanisme production. Respons error JWT dari extension dapat memiliki bentuk `{"msg": "..."}`; respons error yang dibuat route aplikasi memakai envelope `data/meta`.

## 3. Matriks endpoint

| Method | Path | Akses | Fungsi |
|---|---|---|---|
| GET | `/api/health` | Public | Liveness Flask |
| GET | `/api/health/ready` | Public | Kesiapan PostgreSQL dan Redis |
| POST | `/api/auth/login` | Public | Login admin |
| POST | `/api/auth/refresh` | Refresh cookie + CSRF | Memperbarui access cookie |
| POST | `/api/auth/logout` | Access cookie + CSRF | Membersihkan cookie |
| GET | `/api/auth/me` | Access cookie | Identitas pengguna aktif |
| GET | `/api/admin/datasets` | Admin | Daftar dataset |
| POST | `/api/admin/datasets` | Admin + CSRF | Upload dan import CSV bersih |
| POST | `/api/admin/datasets/validate` | Admin + CSRF | Dry-run validasi CSV |
| GET | `/api/admin/datasets/{dataset_id}` | Admin | Detail dataset |
| POST | `/api/admin/datasets/{dataset_id}/parameter-search` | Admin + CSRF | Menjadwalkan parameter search |
| GET | `/api/admin/jobs/{job_id}` | Admin | Status/progress job |
| GET | `/api/admin/jobs/{job_id}/experiments` | Admin | Hasil eksperimen job |
| GET | `/api/admin/datasets/{dataset_id}/runs` | Admin | Riwayat run, maksimum 200 item |
| POST | `/api/admin/datasets/{dataset_id}/runs` | Admin + CSRF | Membuat final clustering run |
| GET | `/api/admin/runs/{run_id}` | Admin | Detail run, eksperimen, job |
| POST | `/api/admin/runs/{run_id}/activate` | Admin + CSRF | Mengaktifkan run |
| GET | `/api/admin/audit-logs` | Admin | Audit log dengan filter/pagination |
| GET | `/api/metadata` | Public | Metadata dataset dan run aktif |
| GET | `/api/summary` | Public | Ringkasan hasil run aktif |
| GET | `/api/profil` | Public | Profil setiap klaster |
| GET | `/api/gempa` | Public | Titik gempa dan label klaster |
| GET | `/api/realtime/latest` | Public, 20/menit/IP | Gempa terbaru BMKG |
| GET | `/api/realtime/m5` | Public, 20/menit/IP | Feed gempa M5+ BMKG |
| GET | `/api/realtime/felt` | Public, 20/menit/IP | Feed gempa dirasakan BMKG |

## 4. Request utama

### Login

`POST /api/auth/login`

```json
{
  "email": "admin@example.com",
  "password": "password-admin"
}
```

Salah satu dari `email` atau `username` harus diisi. Password tidak dikirim ulang pada request lain.

### Upload CSV

`POST /api/admin/datasets`

`multipart/form-data`:
- `file` — CSV bersih.
- `dataset_name` — wajib.
- `source_name` — wajib.
- `source_url` — opsional.
- `preprocessing_version` — opsional.

Sukses: HTTP 201. File dengan SHA-256 yang sudah terdaftar ditolak sebagai konflik.

### Dry-run validasi CSV

`POST /api/admin/datasets/validate`

`multipart/form-data` hanya memerlukan `file`. Sukses HTTP 200 mengembalikan `valid=true` dan `persisted=false`. File tidak didaftarkan sebagai dataset dan file temporary dihapus setelah request. Audit event `DATASET_VALIDATE` tetap ditulis ke audit log; jadi `persisted=false` bukan berarti tidak ada audit record.

### Parameter search

`POST /api/admin/datasets/{dataset_id}/parameter-search`

```json
{
  "min_samples_candidates": [10, 20, 30],
  "sensitivity_percentages": [-10, 0, 10]
}
```

`eps_candidates_km` opsional. Jika dihilangkan atau null, worker menghitung k-distance/knee untuk setiap nilai MinPts dan membentuk kandidat epsilon dari sensitivity percentages. Jika diisi, array epsilon eksplisit dipakai. `min_samples_candidates` wajib array integer >= 2. Response HTTP 202 mengembalikan `job_id`, `task_id`, `status`, `job_type`.

### Membuat final run

`POST /api/admin/datasets/{dataset_id}/runs`

```json
{
  "experiment_id": 15
}
```

`experiment_id` harus eksperimen valid milik dataset tersebut. Backend mengambil epsilon dan MinPts dari eksperimen terpilih. Final DBSCAN menggunakan latitude dan longitude dengan metric Haversine; kedalaman tidak menjadi fitur atau filter clustering dan tetap digunakan untuk profiling setelah clustering.

HTTP 202 mengembalikan `job_id`, `run_id`, `task_id`, `status`.

### Aktivasi run

`POST /api/admin/runs/{run_id}/activate`

Tidak memerlukan request body. Run harus memenuhi syarat service untuk diaktifkan. Database membatasi satu run aktif secara global.

## 5. Aturan CSV pada validator

Header wajib:
`event_id,tanggal,latitude,longitude,magnitude,kedalaman,lokasi`

| Kolom | Aturan |
|---|---|
| `event_id` | Wajib, unik dalam file |
| `tanggal` | ISO-8601, timezone/offset wajib |
| Periode | 2021-01-01 s.d. 2025-12-31 |
| `latitude` | finite numeric, -15 sampai 10 |
| `longitude` | finite numeric, 90 sampai 145 |
| `magnitude` | finite numeric, >= 0 |
| `kedalaman` | boleh kosong; jika diisi finite numeric, >= 0 |
| `lokasi` | Opsional |

Encoding UTF-8/UTF-8-SIG. Validator menolak file pada baris invalid; tidak melakukan cleaning, imputasi, atau drop baris.

## 6. Parameter dan algoritma

- Parameter search: Haversine, koordinat dikonversi ke radian, NearestNeighbors `metric="haversine"` untuk k-distance.
- Jika epsilon tidak diberikan, `KneeLocator(curve="convex", direction="increasing")` dipakai untuk mendeteksi knee; jika knee tidak ditemukan, task gagal dan epsilon tidak dibuat secara otomatis.
- Kandidat DBSCAN diuji dengan `metric="haversine"` dan `algorithm="ball_tree"`.
- Final clustering memakai `latitude` dan `longitude` saja.
- Noise diberi label `-1`.
- Silhouette dihitung pada titik non-noise ketika jumlah klaster memenuhi syarat; sampel dibatasi oleh `SILHOUETTE_MAX_SAMPLE`.
- Magnitudo, kedalaman, tanggal, dan lokasi digunakan untuk profil klaster.
- `dbcv_score` dan `stability_score` dapat bernilai null; jangan menganggap keduanya sudah dihitung.

## 7. Query parameter

### Dataset list

`GET /api/admin/datasets?page=1&limit=20&status=READY`

- `page`: default 1; nilai di bawah 1 dikoreksi menjadi 1.
- `limit`: default 20; dibatasi 1–100.
- `status`: filter status dataset.

### Gempa historis

`GET /api/gempa?page=1&limit=1000&cluster_id=0&min_lat=-10&max_lat=5&min_lon=95&max_lon=130`

- `page`: default 1, minimal 1.
- `limit`: default 1000, maksimum 5000.
- Filter opsional: `cluster_id`, `min_lat`, `max_lat`, `min_lon`, `max_lon`.
- `min_lat <= max_lat` dan `min_lon <= max_lon` jika kedua batas diberikan.

### Audit log

`GET /api/admin/audit-logs?page=1&limit=50`

Filter:
- `action`: partial, case-insensitive.
- `entity_type`: partial, case-insensitive.
- `entity_id`: integer positif, exact.
- `user_id`: integer positif, exact.
- `created_after`, `created_before`: ISO-8601 dengan timezone.
- `q`: pencarian pada action, entity_type, username, email; maksimal 120 karakter.
- `page`: default 1.
- `limit`: default 50, maksimum 200.
- `created_after` tidak boleh lebih besar daripada `created_before`.

Audit log adalah endpoint read-only.

## 8. Status dan error penting

| HTTP | Makna |
|---|---|
| 200 | Operasi baca/validasi/aktivasi berhasil |
| 201 | Dataset berhasil diunggah |
| 202 | Job berhasil dijadwalkan |
| 401 | Autentikasi diperlukan/token tidak valid |
| 403 | Role tidak memiliki izin |
| 404 | Resource tidak ditemukan atau belum ada run aktif |
| 409 | Konflik, misalnya hash dataset duplikat atau job masih berjalan |
| 413 | Ukuran request melewati batas |
| 415 | File bukan CSV |
| 422 | Payload/CSV/query tidak valid |
| 429 | Rate limit |
| 500 | Kesalahan internal |
| 503 | Dependency, worker dispatch, atau upstream BMKG tidak tersedia |

## 9. Batasan implementasi yang perlu dipertahankan dalam integrasi

1. `/api/metadata`, `/api/summary`, `/api/profil`, dan `/api/gempa` memerlukan satu run aktif; tanpa run aktif akan menghasilkan 404.
2. Riwayat run dataset dikembalikan maksimum 200 record dan tidak memiliki parameter pagination pada route saat ini.
3. `meta.count` tidak konsisten sebagai total keseluruhan pada semua list; ikuti penjelasan bagian 1.
4. Perubahan kontrak final clustering yang lebih baru menghapus `depth_thresholds_km`; request hanya membawa `experiment_id`. Kedalaman tetap menjadi atribut profiling pascaklasterisasi.
5. Endpoint dry-run mempersistenkan audit log, tetapi tidak membuat dataset atau menyimpan file upload permanen.
6. Kegagalan JWT dari Flask-JWT-Extended dapat memakai bentuk respons `msg`, bukan selalu envelope aplikasi.


## 10. Parameter Search metadata — Backend 4.1.3/4.1.4

Bagian ini mendokumentasikan lokasi metadata yang dikembalikan backend. Frontend hanya membaca dan menampilkan nilai; frontend tidak menghitung ulang epsilon, melakukan validasi eksperimen, atau membuat rekomendasi.

### 10.1 Detail job

Endpoint: `GET /api/admin/jobs/{job_id}`

Metadata konfigurasi job berada pada `data.parameter_search_metadata` (setelah API client membuka envelope, properti tersedia pada objek job sebagai `parameter_search_metadata`).

| Field | Tipe | Tampilan |
|---|---|---|
| `method_version` | `string \| null` | Versi metode |
| `default_grid_km` | `number[] \| null` | Default grid (km) |
| `epsilon_candidates_km` | `number[] \| null` | Kandidat epsilon aktual (km) |
| `epsilon_candidate_count` | `number \| null` | Jumlah kandidat epsilon |
| `epsilon_rounding_km` | `number \| null` | Pembulatan epsilon (km) |
| `rounding_km` | `number \| null` | Field pembulatan alternatif |
| `combination_mode` | `string \| null` | Mode kombinasi |
| `sensitivity_percentages` | `number[] \| null` | Persentase sensitivitas |
| `source_candidate_counts` | `Record<string, number> \| null` | Jumlah kandidat per sumber |
| `candidate_status` | `string \| object \| null` | Status pembentukan kandidat |

Contoh fragmen response aktual (nilai ilustratif; struktur dan lokasi field mengikuti kontrak):

```json
{
  "data": {
    "id": 53,
    "job_type": "PARAMETER_SEARCH",
    "status": "SUCCESS",
    "parameter_search_metadata": {
      "method_version": "4.1.4",
      "default_grid_km": [10, 15, 20, 25, 30, 40, 50, 60, 75, 100],
      "epsilon_candidates_km": [],
      "epsilon_candidate_count": null,
      "epsilon_rounding_km": 0.5,
      "rounding_km": 0.5,
      "combination_mode": "cross",
      "sensitivity_percentages": [-20, -10, 0, 10, 20],
      "source_candidate_counts": {},
      "candidate_status": null
    }
  },
  "meta": { "status": "success" }
}
```

### 10.2 Metadata eksperimen

Endpoint: `GET /api/admin/jobs/{job_id}/experiments`

Metadata provenance setiap eksperimen berada pada `experiment.evaluation_metadata.parameter_search`.

| Field | Tipe | Tampilan |
|---|---|---|
| `method_version` | `string \| null` | Versi metode |
| `eps_sources` | `string[] \| null` | Sumber epsilon |
| `epsilon_rounding_km` | `number \| null` | Pembulatan epsilon (km) |
| `rounding_km` | `number \| null` | Field pembulatan alternatif |
| `eps_radian` | `number \| null` | Epsilon radian dari backend |
| `combination_mode` | `string \| null` | Mode kombinasi |
| `use_default_grid` | `boolean \| null` | Apakah default grid digunakan |
| `epsilon_candidate_strategy` | `string \| null` | Strategi kandidat epsilon |

Contoh fragmen eksperimen:

```json
{
  "id": 1,
  "eps_km": 30.0,
  "eps_radian": 0.004709,
  "min_samples": 10,
  "is_valid": false,
  "is_recommended": false,
  "evaluation_metadata": {
    "parameter_search": {
      "method_version": "4.1.4",
      "eps_sources": ["grid", "knee:minpts=10:+10%"],
      "epsilon_rounding_km": 0.5,
      "rounding_km": 0.5,
      "eps_radian": 0.004709,
      "combination_mode": "cross",
      "use_default_grid": true,
      "epsilon_candidate_strategy": "merged_sources"
    }
  }
}
```

### 10.3 Pemetaan API ke UI dan kompatibilitas

- Job metadata: `parameter_search_metadata` → panel **Metadata Parameter Search** pada halaman Pencarian Parameter.
- Eksperimen: `evaluation_metadata.parameter_search.eps_sources` → kolom **Sumber epsilon**.
- `epsilon_rounding_km` (fallback `rounding_km`) → **Pembulatan**.
- `method_version` → **Versi metode**.
- Nilai metadata eksperimen nested diprioritaskan; field legacy langsung (`eps_sources`, `epsilon_rounding_km`, `method_version`) hanya menjadi fallback untuk record historis.
- Metadata job/eksperimen yang `null` atau tidak ada ditampilkan sebagai `—`.
- `eps_radian`, `is_valid`, dan `is_recommended` tetap berasal dari backend. Frontend tidak mengonversi epsilon, tidak membentuk ulang status validitas, dan tidak membuat rekomendasi.
- Tidak ada perubahan endpoint atau payload request.

**Acuan versi backend:** 4.1.3 / 4.1.4. Contoh nilai di atas hanya contoh bentuk payload; nilai runtime harus berasal dari response backend.


### 10.4 Provenance eksperimen pada response Job 53 (BE 4.1.3)

Pemeriksaan response aktual `GET /api/admin/jobs/53` menunjukkan bahwa job metadata menyimpan daftar objek `parameter_search_metadata.epsilon_candidates`, dengan struktur:

```json
{
  "eps_km": 20.5,
  "eps_sources": ["knee:minpts=8:-20%"]
}
```

Pada response daftar eksperimen yang diperiksa, objek eksperimen belum menyertakan `evaluation_metadata.parameter_search`. Karena itu, untuk menampilkan provenance pada eksperimen, FE menggunakan pencocokan `experiment.eps_km` terhadap `job.parameter_search_metadata.epsilon_candidates[].eps_km` dan mengambil `eps_sources` dari kandidat yang cocok. Pencocokan menggunakan toleransi numerik `1e-9`.

Prioritas sumber kolom:
1. `experiment.evaluation_metadata.parameter_search.eps_sources` jika tersedia.
2. Field legacy `experiment.eps_sources` jika tersedia.
3. `job.parameter_search_metadata.epsilon_candidates[].eps_sources` berdasarkan kecocokan `eps_km`.
4. `—` jika ketiganya tidak tersedia atau tidak cocok.

Pembulatan dan versi metode juga memakai metadata eksperimen jika ada, lalu field legacy eksperimen, kemudian fallback ke `job.parameter_search_metadata.epsilon_rounding_km` / `rounding_km` dan `method_version`. Ini hanya pemetaan metadata job yang memang berlaku untuk seluruh kombinasi pada job tersebut; FE tidak menyimpulkan provenance dari nilai epsilon atau membuat sumber baru.

Response aktual Job 53 yang diberikan menunjukkan `method_version: "4.1.3"`, `epsilon_rounding_km: 0.5`, `combination_mode: "cross"`, `epsilon_candidate_count: 31`, `combination_count: 155`, serta `epsilon_candidates` berisi pasangan epsilon dan sumbernya. Daftar eksperimen yang diperiksa tidak memuat nested metadata eksperimen, sehingga provenance di UI diambil dari metadata job.


### 10.5 Konsistensi provenance lintas tabel — FE v0.4.32

Kedua tabel menggunakan resolver bersama `src/utils/parameterSearchMetadata.ts`:

- **Hasil Eksperimen** menampilkan seluruh eksperimen dari `GET /api/admin/jobs/{job_id}/experiments`.
- **Eksperimen DBSCAN pada MinPts terpilih** menggunakan array eksperimen yang sama, lalu memfilter `experiment.min_samples === selectedCurve.min_samples`.
- Metadata job berasal dari `GET /api/admin/jobs/{job_id}` melalui polling detail job dan diteruskan ke `ElbowAnalysisPanel` sebagai `jobMetadata`.
- Tabel per MinPts tidak melakukan request eksperimen baru dan filter tidak menghapus properti metadata dari objek.

Resolver mencocokkan `experiment.eps_km` dengan `parameter_search_metadata.epsilon_candidates[].eps_km` (toleransi absolut `1e-9`). `eps_sources` disalin apa adanya dari backend. Karena mode kombinasi adalah cross, sumber seperti `knee:minpts=8:-20%` tetap ditampilkan untuk eksperimen MinPts 10 jika epsilon tersebut berasal dari kandidat MinPts 8.

Urutan prioritas yang sama pada kedua tabel:
1. `experiment.evaluation_metadata.parameter_search` (nested).
2. Field legacy pada objek eksperimen.
3. Metadata kandidat job untuk provenance (`epsilon_candidates`) dan metadata job untuk pembulatan/versi metode.
4. `—` jika tidak tersedia.

Tidak ada provenance yang dibentuk dari MinPts tabel, dan frontend tidak menghitung ulang epsilon/radian atau mengubah `is_valid` / `is_recommended`.
