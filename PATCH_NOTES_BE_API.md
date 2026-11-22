# SeisMap Backend + API Patch Notes

Tanggal: 2026-11-18

## Batas pekerjaan

- Perubahan hanya pada backend, database migration, API response, artefak backend,
  pengujian backend, dan dokumentasi teknis/API.
- Source code frontend tidak diubah dan tidak dimasukkan ke paket backend release.
- Job #25 dan artefak historisnya tidak dihitung ulang, ditimpa, atau di-backfill.
- Dataset tidak diubah.

## Perubahan implementasi

### 1. Evaluasi terpusat

Ditambahkan `services/clustering_evaluation_service.py` agar Parameter Search dan
Final DBSCAN memakai implementasi evaluasi yang sama.

- Silhouette: Haversine, noise `-1` dikeluarkan, deterministic stratified sample,
  maksimum 10.000 titik.
- Davies-Bouldin: rumus DBI standar pada koordinat 3-D unit sphere dengan
  Euclidean chord distance. Tidak memakai latitude-longitude mentah. Metadata
  menyatakan representasi dan distance metric secara eksplisit.
- DBCV: Haversine mutual-reachability MST, `d=2`, `min_points=4`, noise `-1`
  dikeluarkan, deterministic stratified sample maksimum 2.000 titik.
- Jika metrik tidak dapat dihitung, nilainya `null` dan alasan/status disimpan;
  tidak pernah mengganti skor yang tidak tersedia menjadi nol.
- `is_valid` eksperimen dipertahankan untuk kompatibilitas lama dan tetap
  mengikuti ketersediaan Silhouette Score.

### 2. Database

- Menambahkan `dbi_score` dan `evaluation_metadata` pada
  `dbscan_parameter_experiments` dan `dbscan_runs`.
- Menambahkan check constraint DBI non-negatif.
- `dbcv_score` yang sudah ada tetap dipakai.
- Migration baru: `20261118_0004`, parent `20261117_0003`.
- Migration memakai `batch_alter_table` agar kompatibel dengan SQLite test DB
  dan PostgreSQL.
- Data historis tetap dipertahankan. Tidak ada backfill untuk Job #25.

### 3. Parameter Search dan K-distance

- Parameter Search menggunakan service evaluasi terpusat.
- Validasi kandidat MinPts menolak boolean dan nilai pecahan, bukan memotong
  nilai pecahan secara diam-diam.
- Validasi koordinat memeriksa bentuk, finite values, dan rentang latitude /
  longitude sebelum konversi radian.
- Kneedle dikonfigurasi eksplisit dengan `S=1.0`, `curve=convex`,
  `direction=increasing`, `interp1d`, `online=False`.
- Sensitivitas `S=0.5, 1, 2, 4`, persentil K-distance, rank Knee, dan jumlah titik
  setelah Knee disimpan sebagai metadata audit.
- Epsilon Kneedle ditandai sebagai kandidat, bukan parameter final otomatis.

### 4. Artefak upper-tail

Untuk setiap Parameter Search baru, backend membuat grafik dengan tiga panel:

- 100% distribusi;
- 10% distribusi terakhir;
- 1% distribusi terakhir.

Semua panel memakai data K-distance penuh dan rank global yang sama. Knee tidak
pernah dihitung ulang dari potongan visual.

Endpoint unduh baru (query parameter pada endpoint artefak yang sudah ada):

`GET /api/admin/jobs/{job_id}/elbow/{min_samples}/artifact?kind=upper_tail`

Summary/detail Elbow hanya menyertakan `upper_tail_plot_url` jika artefak memang
tersedia. Job lama tanpa artefak upper-tail tidak mendapat tautan yang rusak.

### 5. API metrics

Field berikut ditambahkan secara aditif:

- `dbi_score`
- `dbcv_score`
- `evaluation_metadata`
- `silhouette_sample_size` pada run serializer yang sebelumnya belum mengirimkannya

Field tersedia melalui:

- `GET /api/admin/jobs/{job_id}/experiments`
- `GET /api/admin/datasets/{dataset_id}/runs`
- `GET /api/admin/runs/{run_id}`
- `GET /api/metadata`
- `GET /api/summary`

Tidak ada endpoint hitung-metrik baru; backend tetap menjadi sumber kebenaran.

### 6. Konfigurasi

- Menambahkan `DBCV_MAX_SAMPLE` dengan default `2000`.
- Parameter Search dan Final DBSCAN membaca konfigurasi runtime
  `SILHOUETTE_MAX_SAMPLE`, `DBCV_MAX_SAMPLE`, dan `RANDOM_STATE`.
- Menambahkan `.env.example` aman tanpa credential aktif.

## Dokumen

- `docs/CLUSTERING_EVALUATION_METHOD.md`
- `docs/API_CLUSTERING_EVALUATION_CONTRACT.md`
- `docs/FRONTEND_HANDOFF_PROMPT.md` — prompt implementasi FE; bukan source FE.
- `docs/ELBOW_ANALYSIS_API_CONTRACT.md`
- `docs/job25_upper_tail_audit/` — visualisasi dan metadata dari CSV/JSON asli Job #25.

## Validasi yang berhasil

- Python compileall untuk source backend, route, model, migration, dan tests.
- 4 unit test ClusteringEvaluationService lulus.
- SQLite migration upgrade smoke test lulus.
- SQLite migration downgrade smoke test lulus.
- PostgreSQL migration SQL compile lulus.
- Alembic graph memiliki satu head: `20261118_0004`.
- Upper-tail chart generation smoke test lulus.
- Job #25 audit menggunakan file K-distance asli; tidak menghitung ulang KNN
  atau Knee.

## Belum dapat diverifikasi di lingkungan build ini

- Full pytest aplikasi: Flask dan beberapa dependency backend tidak tersedia di
  lingkungan build dan akses package index tidak tersedia.
- PostgreSQL migration pada server/database pengguna.
- DBCV dan evaluasi final pada seluruh dataset aktual di runtime backend.
- End-to-end API dengan Redis/Celery aktif.

Karena itu patch ini tidak diklaim bebas bug end-to-end sebelum pengujian di
lingkungan SeisMap pengguna dijalankan.
