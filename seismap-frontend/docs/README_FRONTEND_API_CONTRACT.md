> **NOTICE — DOKUMEN LEGACY v0.3.** Dokumen ini dipertahankan sebagai catatan historis. Untuk integrasi saat ini gunakan `BE41_INTEGRATION.md` dan dokumen kontrak BE 4.1 di `docs/contracts/`. Jika ada perbedaan, kontrak BE 4.1 terbaru menjadi acuan.

# SAMLEKOM --- Frontend Development Guide

Dokumentasi acuan tim frontend untuk seluruh aplikasi **Implementasi
Data Mining dengan Algoritma DBSCAN untuk Klasterisasi Spasial Kejadian
Gempa Bumi di Indonesia Berbasis WebGIS**.

> **Status dokumen:** kontrak integrasi berdasarkan snapshot backend
> yang dibagikan pada 14 November 2026, ditambah rancangan integrasi
> BMKG Realtime. Endpoint BMKG internal di dokumen ini menjadi kontrak
> target setelah patch backend pada folder `backend_patch/` diterapkan
> dan diuji. Jangan menganggap endpoint target sudah aktif sebelum
> verifikasi lokal.

------------------------------------------------------------------------

## 1. Tujuan frontend

Frontend adalah antarmuka pengguna untuk dua kelompok fungsi yang harus
tetap terpisah:

1.  **WebGIS penelitian DBSCAN** --- menampilkan hasil klasterisasi dari
    dataset penelitian yang telah diproses dan dipublikasikan oleh
    backend.
2.  **Gempa Realtime BMKG** --- fitur informasi pelengkap aplikasi yang
    mengambil feed publik BMKG. Fitur ini bukan bagian dari penelitian
    data mining.

Frontend tidak menjalankan preprocessing utama, perhitungan DBSCAN,
pencarian parameter, evaluasi klaster, atau penyimpanan data gempa.
Seluruh proses bisnis dan komputasi tersebut berada di backend.

## 2. Batas ruang lingkup dan pemisahan data

### 2.1 Penelitian DBSCAN

-   Dataset penelitian: periode 2021--2025.
-   Dataset bersih disiapkan melalui Jupyter Notebook dan dikirim ke
    backend melalui upload CSV.
-   Fitur DBSCAN hanya latitude dan longitude dengan metric Haversine.
-   Magnitudo, kedalaman, waktu, dan lokasi dipakai sebagai informasi
    profil/analisis, bukan fitur clustering.
-   Label noise adalah `cluster_id = -1`.
-   Public WebGIS hanya membaca satu run yang berstatus `SUCCESS` dan
    aktif secara global.

### 2.2 Gempa Realtime BMKG

-   Data berasal dari endpoint publik BMKG.
-   Halaman realtime adalah halaman terpisah dari WebGIS penelitian.
-   Feed realtime tidak boleh digabungkan dengan CSV penelitian, tabel
    dataset penelitian, tabel `gempa_processed`, eksperimen, membership,
    profil klaster, atau hasil Bab IV.
-   Feed realtime tidak boleh memicu Parameter Search atau Final DBSCAN.
-   Backend menyediakan adapter/proxy dan cache Redis; frontend hanya
    mengonsumsi endpoint internal Flask.
-   Tampilkan atribusi **Sumber data: BMKG (Badan Meteorologi,
    Klimatologi, dan Geofisika)** dan waktu pengambilan/pembaruan data.

## 3. Arsitektur integrasi

``` text
                         FRONTEND (React + Vite)
                                      |
                 +--------------------+--------------------+
                 |                    |                    |
             Admin UI             Public WebGIS       Gempa Realtime
                 |                    |                    |
                 +--------------------+--------------------+
                                      |
                               REST API Flask
                                      |
              +-----------------------+-----------------------+
              |                       |                       |
         Auth/Admin API          Public DBSCAN API       BMKG Realtime API
              |                       |                       |
      PostgreSQL + Celery       PostgreSQL active run     BMKGRealtimeService
              |                       |                       |
          Redis broker/cache    Research result tables      Redis cache
                                                              |
                                                        BMKG Open Data
```

### Aturan penting

-   Semua request frontend ke backend menggunakan `VITE_API_BASE_URL`.
-   Frontend tidak mengakses PostgreSQL atau Redis secara langsung.
-   Frontend tidak memanggil URL BMKG langsung dari browser. Gunakan
    proxy backend agar cache, timeout, dan error handling terpusat.
-   UI route guard tidak menggantikan autentikasi dan otorisasi backend.
-   Tidak boleh menampilkan data dummy sebagai data produksi/realtime.

## 4. Stack dan konvensi frontend

Stack proyek yang sudah ditetapkan:

-   React
-   Vite
-   TypeScript direkomendasikan untuk kontrak API dan model data
-   REST API Flask sebagai sumber data

Library routing, state management, chart, dan peta dapat mengikuti
dependency yang benar-benar dipilih repository frontend. Jangan
menambahkan library baru sebelum memeriksa `package.json`.

### Konvensi kode

-   Pisahkan `pages`, `components`, `services/api`, `types`, `hooks`,
    dan `layouts`.
-   Jangan menaruh fetch API langsung di komponen presentasional.
-   Buat satu API client terpusat untuk base URL, credentials, CSRF,
    parsing envelope, dan error handling.
-   Tipe data API harus mengikuti field backend; jangan mengarang field
    response.
-   Simpan status `loading`, `success`, `empty`, `stale`, dan `error`
    secara eksplisit.
-   Format angka/tanggal hanya di lapisan tampilan; pertahankan nilai
    asli dari API.

## 5. Environment Vite

Buat `.env.local` pada root frontend:

``` dotenv
VITE_API_BASE_URL=http://127.0.0.1:5000
VITE_UI_PREVIEW_MODE=false
```

Aturan:

-   `VITE_API_BASE_URL` hanya berisi origin backend, tanpa menambahkan
    `/api` di akhir.
-   Untuk production, gunakan URL backend HTTPS sesuai deployment.
-   Variabel `VITE_` bersifat publik dan akan masuk ke bundle browser.
    Jangan pernah menaruh password, secret key, JWT secret, database
    URL, atau kredensial privat di dalamnya.

### Mode preview UI

Jika `VITE_UI_PREVIEW_MODE=true`:

-   Halaman admin boleh dipratinjau tanpa autentikasi nyata.
-   Tampilkan label yang terlihat: **Mode Pratinjau**.
-   Seluruh operasi perubahan data dinonaktifkan.
-   Jangan menyatakan pengguna berhasil login.
-   Jangan mengirim request upload, Parameter Search, Final DBSCAN, atau
    aktivasi run.
-   Jangan menampilkan data contoh sebagai hasil aktual penelitian. Data
    contoh harus diberi label preview/demo.

Jika `VITE_UI_PREVIEW_MODE=false`, gunakan backend dan autentikasi
sebenarnya. Preview mode tidak boleh menjadi mekanisme bypass keamanan
backend.

## 6. Struktur halaman yang direkomendasikan

Nama path berikut adalah rancangan route frontend, bukan klaim bahwa
halaman sudah tersedia.

  --------------------------------------------------------------------------------------------------
  Route UI                       Halaman           Akses             Sumber data
  ------------------------------ ----------------- ----------------- -------------------------------
  `/`                            Landing /         Publik            Metadata/summary sesuai desain
                                 ringkasan                           
                                 aplikasi                            

  `/webgis`                      Peta hasil        Publik            `/api/metadata`,
                                 klasterisasi                        `/api/summary`, `/api/profil`,
                                 penelitian                          `/api/gempa`

  `/gempa-realtime`              Informasi gempa   Publik            `/api/realtime/latest`, `/m5`,
                                 realtime BMKG                       `/felt`

  `/admin/login`                 Login admin       Publik            `/api/auth/login`

  `/admin`                       Dashboard admin   Admin             Dataset, job, run

  `/admin/datasets`              Daftar dataset    Admin             `GET /api/admin/datasets`

  `/admin/datasets/:datasetId`   Detail dataset    Admin             Dataset, job, experiments, runs
                                 dan aksi pipeline                   

  `/admin/jobs/:jobId`           Detail progress   Admin             `GET /api/admin/jobs/:job_id`
                                 job                                 

  `/admin/runs`                  Riwayat run       Admin             Endpoint runs per dataset
  --------------------------------------------------------------------------------------------------

Navigasi publik harus membedakan **WebGIS Penelitian** dan **Gempa
Realtime** secara visual dan tekstual.

## 7. API contract umum

Semua endpoint backend menggunakan response envelope.

### Response sukses

``` json
{
  "data": {},
  "meta": {
    "status": "success"
  }
}
```

### Response daftar

``` json
{
  "data": [],
  "meta": {
    "status": "success",
    "count": 0,
    "limit": 20,
    "offset": 0
  }
}
```

### Response gagal

``` json
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

API client harus memeriksa `response.ok` dan `meta.status`; jangan
menganggap HTTP 200 selalu berarti operasi bisnis berhasil.

### Status HTTP yang perlu ditangani

  -----------------------------------------------------------------------
  HTTP                    Makna umum              Perilaku UI
  ----------------------- ----------------------- -----------------------
  `200`                   Berhasil                Tampilkan data

  `201`                   Resource dibuat         Tampilkan hasil upload

  `202`                   Job diterima/diantrekan Buka panel progress;
                                                  belum berarti selesai

  `401`                   Belum login/token tidak Jalankan alur
                          valid                   refresh/login

  `403`                   Tidak berhak            Tampilkan akses ditolak

  `404`                   Resource/run tidak      Tampilkan
                          ditemukan               empty/not-found state

  `409`                   Konflik status,         Tampilkan pesan konflik
                          misalnya job aktif      dan status terkait

  `422`                   Validasi gagal          Tampilkan pesan dari
                                                  backend

  `429`                   Terlalu banyak request  Tampilkan rate-limit
                                                  state dan tunggu
                                                  sebelum retry

  `503`                   Provider/layanan        Tampilkan error
                          sementara gagal         sementara; jangan
                                                  mengarang data
  -----------------------------------------------------------------------

## 8. API client, cookie, dan CSRF

Backend menggunakan JWT di cookie `HttpOnly` dengan proteksi CSRF.
Jangan menyimpan access token atau refresh token di `localStorage` atau
`sessionStorage`.

Contoh dasar request:

``` ts
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export async function apiRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
  });

  const body = await response.json();
  if (!response.ok || body?.meta?.status === "error") {
    throw new Error(body?.meta?.message ?? `HTTP ${response.status}`);
  }
  return body.data as T;
}
```

Contoh tersebut adalah pola minimal. Implementasi final harus
menambahkan parsing error terstruktur dan CSRF untuk request yang
memerlukannya.

### CSRF

-   `POST /api/auth/login` tidak membutuhkan access-token CSRF karena
    login dilakukan sebelum sesi terbentuk.
-   Request mutasi yang menggunakan access cookie harus mengirim header
    `X-CSRF-TOKEN` sesuai konfigurasi Flask-JWT-Extended.
-   Ambil nilai CSRF dari cookie CSRF yang memang disediakan backend;
    cookie access/refresh JWT tetap `HttpOnly`.
-   `POST /api/auth/refresh` menggunakan refresh cookie dan CSRF token
    refresh.
-   `POST /api/auth/logout` menggunakan access cookie dan CSRF token
    access.
-   Nama cookie CSRF harus dicocokkan dengan konfigurasi backend aktual.
    Jangan hardcode nama cookie jika backend mengubah konfigurasi.

Backend harus mengizinkan origin frontend secara eksplisit melalui
`FRONTEND_ORIGIN` dan `supports_credentials=True`. Jangan menggunakan
wildcard origin bersama credentials.

## 9. Autentikasi admin

  Method   Endpoint              Kegunaan
  -------- --------------------- ------------------------------------------
  POST     `/api/auth/login`     Login dengan email/username dan password
  POST     `/api/auth/refresh`   Memperbarui access cookie
  POST     `/api/auth/logout`    Menghapus cookie sesi
  GET      `/api/auth/me`        Mengambil identitas admin aktif

Login body:

``` json
{
  "email": "admin@example.com",
  "password": "<password-admin>"
}
```

`username` dapat dipakai sebagai pengganti `email` jika backend menerima
identitas tersebut.

Login sukses mengembalikan objek `data.user` berisi `id`, `email`,
`username`, dan `role`, serta mengatur cookie. Setelah login, panggil
`/api/auth/me` untuk memastikan sesi dapat digunakan.

### Perilaku UI

-   Jangan membuat form registrasi admin publik.
-   Jangan menaruh kredensial admin default di source code.
-   Jangan menyatakan login sukses hanya karena tombol diklik; tunggu
    respons backend.
-   Saat 401, coba refresh satu kali jika sesi refresh tersedia. Jika
    gagal, arahkan ke login.
-   Logout harus menunggu respons backend sebelum mengubah status sesi
    lokal.
-   Admin route guard hanya untuk navigasi UI; backend tetap sumber
    otorisasi.

## 10. Admin --- Dataset

### Daftar dataset

`GET /api/admin/datasets?page=1&limit=20&status=READY`

Query `status` opsional. Response item yang didokumentasikan:

``` ts
interface DatasetItem {
  id: number;
  dataset_name: string;
  source_name: string;
  start_date: string;
  end_date: string;
  raw_row_count: number;
  cleaned_row_count: number;
  rejected_row_count: number;
  status: string;
  created_at: string | null;
}
```

### Upload dataset

`POST /api/admin/datasets`

Gunakan `multipart/form-data`, bukan JSON.

Field wajib:

-   `file` --- CSV bersih dari Jupyter Notebook.
-   `dataset_name`.
-   `source_name`.

Field opsional:

-   `source_url`.
-   `preprocessing_version`.

Contoh `FormData`:

``` ts
const form = new FormData();
form.append("file", file);
form.append("dataset_name", datasetName);
form.append("source_name", sourceName);
form.append("preprocessing_version", preprocessingVersion);

const result = await apiRequest<UploadResult>("/api/admin/datasets", {
  method: "POST",
  headers: { "X-CSRF-TOKEN": csrfToken },
  body: form,
});
```

Jangan menetapkan `Content-Type` secara manual untuk `FormData`; browser
akan membuat multipart boundary.

Response upload yang didokumentasikan:

``` ts
interface UploadResult {
  dataset_id: number;
  dataset_name: string;
  status: "READY" | string;
  raw_row_count: number;
  cleaned_row_count: number;
  rejected_row_count: number;
  date_range: { start: string; end: string };
  file_hash_sha256: string;
}
```

Validasi backend mensyaratkan header CSV:

``` text
event_id,tanggal,latitude,longitude,magnitude,kedalaman,lokasi
```

Ketentuan yang perlu disampaikan di UI:

-   CSV harus sudah diproses dan dibersihkan melalui Jupyter Notebook.
-   Periode penelitian 2021--2025.
-   Batas geografis penelitian latitude -15 sampai 10 dan longitude 90
    sampai 145.
-   Timestamp harus memiliki informasi zona waktu/offset.
-   `event_id` harus unik dan wajib.
-   Magnitude wajib numerik dan tidak negatif.
-   Kedalaman boleh kosong sesuai kontrak, tetapi jika terisi harus
    numerik dan tidak negatif.
-   `lokasi` wajib diisi sesuai validasi upload backend saat ini.
-   Backend menolak seluruh upload jika ada baris invalid; frontend
    tidak boleh mengubah atau menghapus baris diam-diam.

Tampilkan hasil upload dari respons backend. HTTP 201 berarti dataset
berhasil dibuat; tampilkan `dataset_id` dan status yang benar-benar
dikembalikan.

## 11. Admin --- Parameter Search

Endpoint:

`POST /api/admin/datasets/{dataset_id}/parameter-search`

Body:

``` json
{
  "min_samples_candidates": [4, 5, 8, 10],
  "sensitivity_percentages": [-20, -10, 0, 10, 20]
}
```

`eps_candidates_km` boleh dikirim jika admin/peneliti memang menyediakan
kandidat eksplisit. Nilai contoh di dokumen ini bukan parameter final
penelitian.

Ketentuan UI:

-   Hanya izinkan proses pada dataset berstatus `READY` atau
    `PROCESSED`.
-   Validasi array angka/integer sebelum mengirim.
-   Jangan menetapkan parameter final secara otomatis berdasarkan
    contoh.
-   Jika backend mengembalikan `202`, tampilkan job sebagai
    `QUEUED`/diterima, bukan selesai.
-   Tangani `409 JOB_ALREADY_RUNNING` dengan menampilkan job yang sudah
    berjalan jika `details.job_id` tersedia.

## 12. Admin --- Job progress dan eksperimen

### Status job

`GET /api/admin/jobs/{job_id}`

``` ts
interface ProcessingJob {
  id: number;
  dataset_id: number;
  run_id: number | null;
  job_type: "PARAMETER_SEARCH" | "FINAL_CLUSTERING";
  status: "QUEUED" | "RUNNING" | "SUCCESS" | "FAILED" | "CANCELLED";
  progress: number;
  current_step: string | null;
  message: string | null;
  error_code: string | null;
  created_at: string | null;
  started_at: string | null;
  finished_at: string | null;
}
```

Polling:

-   Poll setiap 2--5 detik selama status `QUEUED` atau `RUNNING`.
-   Hentikan polling pada `SUCCESS`, `FAILED`, atau `CANCELLED`.
-   Bersihkan interval saat komponen unmount atau job berganti.
-   Jangan memakai status Celery dari browser; endpoint PostgreSQL job
    adalah sumber status bisnis.
-   Tampilkan `message`, `current_step`, dan `progress` apa adanya dari
    backend.
-   Jika `FAILED`, tampilkan `error_code` dan pesan yang aman; detail
    teknis sensitif tidak boleh diminta dari frontend.

### Daftar eksperimen

`GET /api/admin/jobs/{job_id}/experiments`

Field item yang didokumentasikan:

``` ts
interface ParameterExperiment {
  id: number;
  dataset_id: number;
  job_id: number;
  eps_km: number;
  eps_radian: number;
  min_samples: number;
  cluster_count: number;
  noise_count: number;
  noise_percentage: number;
  clustered_count: number;
  min_cluster_size: number | null;
  median_cluster_size: number | null;
  max_cluster_size: number | null;
  silhouette_score: number | null;
  silhouette_sample_size: number | null;
  is_valid: boolean;
  invalid_reason: string | null;
  is_recommended: boolean;
}
```

Tampilkan eksperimen valid dan tidak valid secara jelas.
`is_recommended` adalah penanda rekomendasi backend, bukan persetujuan
final otomatis dari peneliti.

## 13. Admin --- Final DBSCAN dan aktivasi run

### Membuat final run

`POST /api/admin/datasets/{dataset_id}/runs`

Body:

```json
{
  "experiment_id": 123
}
```

Frontend tidak meminta atau mengirim threshold kedalaman. Backend mengambil
epsilon dan MinPts dari eksperimen yang dipilih. DBSCAN hanya menggunakan
latitude dan longitude dengan metric Haversine. Kedalaman tetap dipakai
backend untuk profiling setelah clustering.

Respons `202` berarti job diterima. Simpan `job_id`, `run_id`, dan
`task_id` yang dikembalikan, lalu pantau job melalui endpoint status.

### Riwayat run

`GET /api/admin/datasets/{dataset_id}/runs`

Field yang didokumentasikan:

``` ts
interface DBSCANRun {
  id: number;
  dataset_id: number;
  selected_experiment_id: number;
  eps_km: number;
  eps_radian: number;
  min_samples: number;
  metric: "haversine" | string;
  cluster_count: number | null;
  noise_count: number | null;
  noise_percentage: number | null;
  total_points: number | null;
  silhouette_score: number | null;
  status: "DRAFT" | "CLUSTERING" | "SUCCESS" | "FAILED" | "ARCHIVED";
  is_active: boolean;
  created_at: string | null;
  completed_at: string | null;
  activated_at: string | null;
}
```

### Aktivasi run

`POST /api/admin/runs/{run_id}/activate`

-   Hanya run berstatus `SUCCESS` yang dapat diaktifkan.
-   Run aktif bersifat global, bukan per dataset.
-   Setelah aktivasi, Public WebGIS akan membaca run aktif yang baru.
-   Tampilkan konfirmasi sebelum aktivasi karena ini mengubah data yang
    terlihat oleh pengguna publik.
-   Jangan optimistis mengubah badge `is_active` sebelum backend
    mengonfirmasi sukses.

## 14. Public WebGIS --- hasil penelitian

Semua endpoint berikut bersifat publik dan membaca **satu run DBSCAN
aktif global**.

  -----------------------------------------------------------------------
  Method                  Endpoint                Fungsi
  ----------------------- ----------------------- -----------------------
  GET                     `/api/metadata`         Metadata dataset dan
                                                  run aktif

  GET                     `/api/summary`          Ringkasan jumlah titik,
                                                  klaster, noise,
                                                  Silhouette

  GET                     `/api/profil`           Profil tiap klaster

  GET                     `/api/gempa`            Titik gempa beserta
                                                  label klaster/noise
  -----------------------------------------------------------------------

### Metadata

Field yang didokumentasikan:

-   `dataset`: `id`, `name`, `source_name`, `start_date`, `end_date`,
    `raw_row_count`, `cleaned_row_count`.
-   `run`: `id`, `status`, `eps_km`, `eps_radian`, `min_samples`,
    `metric`, `earth_radius_km`, `created_at`, `completed_at`,
    `activated_at`.

### Summary

Field:

-   `dataset_id`
-   `dataset_name`
-   `total_points`
-   `cluster_count`
-   `noise_count`
-   `noise_percentage`
-   `silhouette_score`
-   `profile_count`

### Profil klaster

Field yang didokumentasikan:

-   `cluster_id`, `event_count`
-   `avg_magnitude`, `min_magnitude`, `max_magnitude`
-   `avg_depth`, `min_depth`, `max_depth`
-   `shallow_event_count`, `medium_event_count`, `deep_event_count`
-   `first_event_date`, `last_event_date`
-   `centroid_latitude`, `centroid_longitude`
-   `dominant_location`, `radius_km`, `max_radius_km`

### Titik gempa

`GET /api/gempa?page=1&limit=1000`

Query yang didokumentasikan:

-   `page`, minimal 1.
-   `limit`, 1 sampai 5000.
-   `min_lat`, `max_lat`, `min_lon`, `max_lon`.
-   `cluster_id`.

Field item:

``` ts
interface ResearchEarthquake {
  id: number;
  event_id: string;
  tanggal: string;
  latitude: number;
  longitude: number;
  magnitude: number;
  kedalaman: number | null;
  lokasi: string | null;
  cluster_id: number;
  is_noise: boolean;
}
```

Peta:

-   Gunakan `latitude` sebagai latitude dan `longitude` sebagai
    longitude.
-   `cluster_id = -1` atau `is_noise = true` harus divisualisasikan
    sebagai noise.
-   Jangan menganggap ID cluster memiliki makna ordinal; label cluster
    hanya identifier.
-   Untuk data besar, gunakan pagination dan jangan mengambil seluruh
    data tanpa batas.
-   Jika belum ada run aktif, tampilkan empty state yang menyatakan
    hasil penelitian belum dipublikasikan. Jangan mengganti dengan data
    realtime BMKG.

## 15. Halaman Gempa Realtime BMKG

### 15.1 Sumber resmi

Portal data terbuka BMKG:

-   <https://data.bmkg.go.id/gempabumi/>
-   <https://github.com/infoBMKG/data-gempabumi>

Endpoint publik upstream:

  ------------------------------------------------------------------------------------------------------------
  Kategori                URL BMKG                                                     Bentuk data
  ----------------------- ------------------------------------------------------------ -----------------------
  Gempa terbaru           `https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json`        Satu objek gempa

  Gempa M 5.0+            `https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json`     Array, maksimal 15 item

  Gempa dirasakan         `https://data.bmkg.go.id/DataMKG/TEWS/gempadirasakan.json`   Array, maksimal 15 item
  ------------------------------------------------------------------------------------------------------------

BMKG menyatakan data diperbarui setiap ada peristiwa, batas akses 60
request/menit/IP, dan atribusi BMKG wajib ditampilkan. Field `DateTime`
menggunakan ISO 8601 UTC; `Tanggal`/`Jam` disajikan dalam WIB.
`Coordinates` berurutan latitude kemudian longitude.

### 15.2 Endpoint internal Flask

Setelah patch backend diterapkan:

  Method   Endpoint internal        Isi
  -------- ------------------------ ------------------------
  GET      `/api/realtime/latest`   Satu gempa terbaru
  GET      `/api/realtime/m5`       Daftar gempa M 5.0+
  GET      `/api/realtime/felt`     Daftar gempa dirasakan

Ketiganya publik, read-only, tidak membutuhkan login.

### 15.3 Bentuk response internal

Response latest:

``` json
{
  "data": {
    "source": "BMKG",
    "source_name": "Badan Meteorologi, Klimatologi, dan Geofisika",
    "source_url": "https://data.bmkg.go.id/gempabumi/",
    "category": "latest",
    "fetched_at": "2026-11-14T03:15:00Z",
    "cache_status": "MISS",
    "is_stale": false,
    "warning": null,
    "cache_ttl_seconds": 60,
    "count": 1,
    "earthquake": {
      "event_time_utc": "2026-11-14T03:15:00+00:00",
      "date_local": "14 Nov 2026",
      "time_local": "10:15:00 WIB",
      "magnitude": 4.8,
      "depth_km": 10.0,
      "latitude": -6.2,
      "longitude": 106.8,
      "coordinates": [-6.2, 106.8],
      "latitude_label": "6.20 LS",
      "longitude_label": "106.80 BT",
      "depth_label": "10 km",
      "region": "Contoh wilayah",
      "tsunami_potential": "Tidak berpotensi tsunami",
      "felt": "II Jakarta",
      "shakemap_url": "https://static.bmkg.go.id/20261114031500.mmi.jpg"
    }
  },
  "meta": { "status": "success" }
}
```

Contoh di atas hanya menjelaskan bentuk response; angka dan teksnya
bukan data gempa aktual.

Untuk `/m5` dan `/felt`, field `earthquake` diganti dengan
`earthquakes: []` dan `count` sesuai jumlah item.

### 15.4 TypeScript types

``` ts
export interface RealtimeEarthquake {
  event_time_utc: string | null;
  date_local: string | null;
  time_local: string | null;
  magnitude: number;
  depth_km: number | null;
  latitude: number;
  longitude: number;
  /** Urutan [latitude, longitude], bukan GeoJSON [longitude, latitude]. */
  coordinates: [number, number];
  latitude_label: string | null;
  longitude_label: string | null;
  depth_label: string | null;
  region: string | null;
  tsunami_potential: string | null;
  felt: string | null;
  shakemap_url: string | null;
}

export interface RealtimeFeed<T> {
  source: "BMKG";
  source_name: string;
  source_url: string;
  category: "latest" | "m5" | "felt";
  fetched_at: string;
  cache_status: "MISS" | "HIT" | "STALE";
  is_stale: boolean;
  warning: string | null;
  cache_ttl_seconds: number;
  count: number;
  earthquake?: T;
  earthquakes?: T[];
}
```

### 15.5 Aturan tampilan

Halaman `/gempa-realtime` dapat memiliki tiga tab:

1.  **Terbaru** --- kartu detail gempa terbaru dan shakemap jika
    tersedia.
2.  **M 5.0+** --- daftar gempa bermagnitudo 5.0 ke atas.
3.  **Dirasakan** --- daftar kejadian dengan keterangan wilayah/tingkat
    dirasakan jika tersedia.

Komponen minimum:

-   waktu kejadian dan zona waktu;
-   magnitudo;
-   kedalaman;
-   lokasi/wilayah;
-   koordinat;
-   potensi tsunami bila disediakan BMKG;
-   informasi dirasakan/MMI bila disediakan;
-   shakemap bila tersedia;
-   waktu data diambil (`fetched_at`);
-   label sumber BMKG.

State UI wajib:

-   `loading`: request pertama sedang berlangsung;
-   `success`: data berhasil diterima;
-   `empty`: daftar kosong;
-   `stale`: `is_stale === true`; tampilkan warning yang dikirim
    backend;
-   `error`: backend mengembalikan error, termasuk 503 atau 429.

Jangan menyembunyikan status stale. Jangan menyatakan data stale sebagai
pembaruan realtime terbaru. Jangan membuat alarm/peringatan keselamatan
sendiri dari feed ini. Untuk informasi resmi keselamatan dan peringatan
tsunami, arahkan pengguna ke kanal resmi BMKG.

### 15.6 Polling frontend

-   Jangan polling per detik.
-   Gunakan interval konservatif, misalnya 60 detik atau lebih.
-   Polling boleh dihentikan ketika tab realtime tidak aktif/halaman
    tidak terlihat.
-   Jangan menjalankan request duplikat dari beberapa komponen untuk
    kategori yang sama; gunakan satu query/cache layer bersama.
-   Hormati `429` dan jangan langsung melakukan retry berulang.
-   Backend Redis cache adalah cache bersama; cache browser/query
    frontend hanya lapisan tambahan.

## 16. Navigasi dan pengalaman pengguna

Navigasi utama publik disarankan:

-   **WebGIS Penelitian**
-   **Gempa Realtime**
-   **Tentang** (opsional)

Area admin disarankan:

-   Dashboard
-   Dataset
-   Parameter Search
-   Final DBSCAN / Riwayat Run
-   Akun / Logout

Jangan menyatukan layer marker gempa realtime dan layer hasil DBSCAN
dalam satu sumber data atau legenda yang sama. Jika suatu saat ada
tampilan perbandingan, berikan pemisahan layer, legenda, label sumber,
dan keterangan metodologis yang tegas.

## 17. Konfigurasi dan deployment frontend

Environment production harus menggunakan HTTPS dan backend origin
eksplisit pada konfigurasi CORS.

Checklist:

-   [ ] `.env.local` tidak masuk Git.
-   [ ] `.env.example` hanya berisi URL contoh tanpa secret.
-   [ ] `VITE_API_BASE_URL` sesuai backend environment.
-   [ ] `VITE_UI_PREVIEW_MODE=false` pada deployment nyata.
-   [ ] Browser mengirim `credentials: include`.
-   [ ] CSRF header digunakan untuk request mutasi.
-   [ ] Tidak ada JWT/token di localStorage.
-   [ ] Tidak ada endpoint/database credential di bundle.
-   [ ] CORS backend mengizinkan origin frontend yang tepat.
-   [ ] Semua error API memiliki tampilan yang dapat dipahami pengguna.

## 18. Testing checklist tim frontend

### Public WebGIS

-   [ ] Metadata aktif berhasil ditampilkan.
-   [ ] Summary sesuai response backend.
-   [ ] Profil klaster ditampilkan tanpa mengubah nilai.
-   [ ] Peta menggunakan latitude/longitude dengan benar.
-   [ ] Noise `cluster_id = -1` memiliki simbol/legenda tersendiri.
-   [ ] Pagination dan filter peta bekerja.
-   [ ] Empty state tampil jika belum ada run aktif.

### Gempa Realtime

-   [ ] Latest menampilkan satu objek.
-   [ ] M 5.0+ menampilkan daftar.
-   [ ] Dirasakan menampilkan daftar.
-   [ ] Koordinat dipetakan dengan urutan latitude-longitude.
-   [ ] Shakemap bersifat opsional.
-   [ ] Timestamp UTC dan label WIB tidak tertukar.
-   [ ] Atribusi BMKG selalu terlihat.
-   [ ] Cache HIT dan STALE ditampilkan sesuai status.
-   [ ] 503, 429, empty, dan loading state diuji.
-   [ ] Tidak ada request langsung ke BMKG dari browser.
-   [ ] Tidak ada data realtime masuk ke UI/endpoint penelitian DBSCAN.

### Admin

-   [ ] Login gagal/sukses mengikuti respons API.
-   [ ] Refresh session dan logout diuji.
-   [ ] CSRF request diuji di browser, bukan hanya Postman.
-   [ ] Upload CSV menampilkan hasil dan error validasi backend.
-   [ ] Parameter Search menerima response 202 dan memantau job.
-   [ ] Eksperimen invalid/recommended dibedakan.
-   [ ] Final DBSCAN mengirim experiment ID dan threshold eksplisit.
-   [ ] Aktivasi hanya ditawarkan untuk run SUCCESS.
-   [ ] Setelah aktivasi, public WebGIS memuat metadata run baru.

### Preview mode

-   [ ] Label Mode Pratinjau terlihat.
-   [ ] Login tidak diklaim berhasil.
-   [ ] Tombol mutasi disabled.
-   [ ] Tidak ada request upload/Parameter Search/Final DBSCAN/activate.

## 19. Batas backend yang perlu dikonfirmasi

Dokumentasi ini mengikuti kontrak dan potongan implementasi backend yang
telah dibagikan. Sebelum integrasi produksi, tim wajib memverifikasi:

1.  URL dan port backend yang aktif.
2.  Nama cookie CSRF aktual pada konfigurasi Flask-JWT-Extended.
3.  Bentuk response endpoint aktual melalui OpenAPI/Postman atau browser
    network.
4.  Endpoint realtime internal setelah patch diterapkan.
5.  CORS untuk origin frontend development dan production.
6.  Pagination `/api/gempa` dan batas data aktual.
7.  Field response baru jika backend mengalami perubahan.

Jika implementasi aktual berbeda dari README, perbarui kontrak
berdasarkan kode dan test backend yang benar. Jangan menyesuaikan
backend hanya dengan mengasumsikan field dari dokumen ini.

## 20. Referensi

-   Backend project README: `README_BACKEND_BE_4_1.md`.
-   Backend API contract: `webgis_api_tasks_revision/API_CONTRACT.md`.
-   Backend blueprint: `BLUEPRINT_BACKEND_DBSCAN.md`.
-   BMKG Data Gempabumi Terbuka: <https://data.bmkg.go.id/gempabumi/>.
-   Repository resmi BMKG: <https://github.com/infoBMKG/data-gempabumi>.

------------------------------------------------------------------------

**Prinsip utama:** frontend menyajikan data dan mengendalikan interaksi
pengguna; backend memegang validasi, autentikasi, proses bisnis,
komputasi, dan integritas data. Data penelitian DBSCAN dan informasi
gempa realtime BMKG adalah dua domain berbeda dan tidak boleh dicampur.
