# Backend WebGIS Gempa Bumi — DBSCAN

Backend Flask untuk proyek **Implementasi Data Mining dengan Algoritma DBSCAN untuk Klasterisasi Spasial Kejadian Gempa Bumi di Indonesia Berbasis WebGIS**.

Paket ini merupakan kelanjutan Fase 1. Fase 2 menambahkan sepuluh model database, constraint integritas, indeks, dan Alembic migration awal sesuai `BLUEPRINT_BACKEND_DBSCAN.md`.

## 1. Isi Fase 2

- Seluruh 10 model ORM: `users`, `dataset_info`, `gempa_processed`, `processing_jobs`, `dbscan_parameter_experiments`, `dbscan_runs`, `dbscan_memberships`, `profil_klaster`, `processing_artifacts`, dan `audit_logs`.
- Foreign key langsung dan komposit untuk menjaga agar job, eksperimen, run, membership, dan artefak tidak menghubungkan data dari dataset berbeda.
- Check constraint untuk rentang koordinat, magnitudo, kedalaman, status, progress, noise, dan konsistensi jumlah baris.
- Unique index parsial agar hanya satu run DBSCAN aktif secara global.
- Tipe PostgreSQL `JSONB` dan `INET`, dengan fallback SQLite untuk unit test.
- Alembic revision `20261114_0001`.
- Unit test untuk registrasi tabel dan beberapa constraint database.

Belum ada upload CSV, import dataset penelitian, autentikasi, background processing, maupun eksekusi DBSCAN pada fase ini.

## 2. Prasyarat

- Python 3.12
- Docker Engine + Docker Compose plugin
- PostgreSQL 15+ dan Redis 7+ (tersedia melalui Docker Compose)

## 3. Persiapan lingkungan

```bash
cp .env.example .env
```

Isi `.env` dengan secret lokal yang kuat dan kredensial PostgreSQL. `DATABASE_URL` harus menggunakan kredensial yang sama dengan `POSTGRES_USER`, `POSTGRES_PASSWORD`, dan `POSTGRES_DB`.

Jalankan PostgreSQL dan Redis:

```bash
docker compose up -d
```

Buat virtual environment dan pasang dependensi:

```bash
python3.12 -m venv .venv
source .venv/bin/activate        # Windows: .venv\\Scripts\\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
```

## 4. Terapkan database migration

Direktori migration sudah disertakan, sehingga tidak perlu menjalankan `db init` lagi.

```bash
flask --app 'app:create_app' db upgrade
flask --app 'app:create_app' db current
flask --app 'app:create_app' db heads
```

Migration awal membuat sepuluh tabel sesuai blueprint. Jalankan pada database pengembangan terlebih dahulu dan periksa hasilnya sebelum dipakai untuk data penelitian.

Untuk perubahan model berikutnya:

```bash
flask --app 'app:create_app' db migrate -m "describe schema change"
```

Tinjau migration hasil autogenerate secara manual, khususnya foreign key komposit, circular foreign key, check constraint, dan partial index, sebelum menjalankan `db upgrade`.

**Peringatan:** jangan menjalankan `db downgrade` pada database yang sudah berisi data penelitian tanpa backup dan persetujuan eksplisit.

## 5. Menjalankan API

```bash
flask --app 'app:create_app' run --debug
```

Health checks:

```bash
curl http://127.0.0.1:5000/api/health
curl http://127.0.0.1:5000/api/health/ready
```

## 6. Pengujian

```bash
pytest -q
```

Unit test model menggunakan SQLite in-memory. Migration dan constraint khusus PostgreSQL tetap harus diverifikasi pada PostgreSQL 15+ aktual sebelum deployment.

## 7. Catatan desain database

- PostgreSQL memakai `BIGINT` untuk primary key. Model mengubahnya menjadi `INTEGER` pada SQLite agar autoincrement dapat diuji.
- PostgreSQL memakai `JSONB`; SQLite menggunakan JSON kompatibel untuk unit test.
- PostgreSQL memakai `INET` untuk alamat IP; SQLite memakai string IPv4/IPv6.
- Atribut Python `ProcessingArtifact.artifact_metadata` dipetakan ke kolom database bernama `metadata` karena `metadata` merupakan atribut khusus SQLAlchemy Declarative.
- Foreign key komposit pada membership dan artefak mempertahankan konsistensi dataset.
- Circular foreign key `processing_jobs(run_id, dataset_id)` ke `dbscan_runs(id, dataset_id)` dibuat setelah kedua tabel tersedia dalam migration.
- Partial unique index membatasi satu run aktif secara global sesuai blueprint.

Detail implementasi dan batasan ada pada `PHASE2_NOTES.md`.

## 8. Status implementasi

| Komponen | Status |
|---|---|
| Fondasi Flask Fase 1 | Dibawa dari paket Fase 1 |
| Sepuluh model database | Dibuat |
| Constraint dan indeks | Dibuat |
| Alembic initial migration | Dibuat, belum dijalankan pada DB pengguna |
| Unit test model | Ditambahkan, perlu dijalankan pada lingkungan dependensi lengkap |
| PostgreSQL integration test | Belum dijalankan |
| Auth admin | Fase 3 |
| Upload dan validasi CSV | Fase 4 |
| Parameter search dan DBSCAN | Fase 6–7 |
| Public WebGIS API dan BMKG | Fase 8 |

### Hasil pemeriksaan paket saat dibuat

- Python compile check: lulus.
- SQLAlchemy metadata memuat 10 tabel: lulus.
- Pembuatan schema model pada SQLite in-memory: lulus.
- Dua check constraint (role admin dan latitude global): lulus.
- Kompilasi DDL migration untuk dialek PostgreSQL: lulus.
- Full `pytest -q` dan eksekusi migration pada PostgreSQL nyata: belum dijalankan karena dependency Flask tidak tersedia pada lingkungan build ini. Jalankan setelah instalasi dependensi di lingkungan lokal.


## 9. Evaluasi kualitas klaster (revisi 20261118)

- Silhouette memakai Haversine dan sampel stratified deterministik non-noise.
- Davies-Bouldin memakai rumus DBI standar pada representasi koordinat 3-D unit sphere dengan Euclidean chord distance; bukan Haversine murni.
- DBCV memakai Haversine mutual-reachability MST dan sampel stratified deterministik maksimum 2.000 titik karena kebutuhan matriks jarak kuadratik.
- Noise label `-1` dikeluarkan dari ketiga metrik dan tetap dilaporkan sebagai statistik DBSCAN.
- Hasil metrik dan metadata metode disimpan pada eksperimen dan final run serta dipublikasikan melalui API yang sudah ada.
- Migration baru: `20261118_0004`. Nilai historis tidak di-backfill.
- Lihat `docs/CLUSTERING_EVALUATION_METHOD.md` dan `docs/API_CLUSTERING_EVALUATION_CONTRACT.md`.
