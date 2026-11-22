# Catatan Implementasi Fase 2 — Database

## Cakupan

Fase ini menambahkan sepuluh model ORM sesuai `BLUEPRINT_BACKEND_DBSCAN.md`, constraint integritas, indeks, dan satu Alembic revision awal.

## Tabel

1. `users`
2. `dataset_info`
3. `gempa_processed`
4. `processing_jobs`
5. `dbscan_parameter_experiments`
6. `dbscan_runs`
7. `dbscan_memberships`
8. `profil_klaster`
9. `processing_artifacts`
10. `audit_logs`

## Integritas penting

- `event_id` unik di dalam satu dataset.
- `gempa_processed`, `processing_jobs`, eksperimen, dan run menyediakan unique key komposit `(id, dataset_id)` untuk menjaga relasi lintas dataset.
- Eksperimen terhubung ke job dan dataset yang sama melalui foreign key komposit.
- Run terhubung ke eksperimen dan dataset yang sama melalui foreign key komposit.
- Membership menghubungkan run dan gempa yang berasal dari dataset yang sama.
- Artefak opsional mengacu ke job/run yang berasal dari dataset yang sama.
- Noise harus memiliki `cluster_id = -1`; non-noise harus memiliki `cluster_id >= 0`.
- Partial unique index membatasi hanya satu `dbscan_runs.is_active = true` secara global.
- `processing_jobs` memiliki circular composite FK ke `dbscan_runs`; migration membuat FK tersebut setelah kedua tabel tersedia.
- PostgreSQL menggunakan `JSONB` dan `INET`; SQLite memakai tipe kompatibel untuk unit test.

## Keputusan dan batasan

- Nama tabel dan kolom mengikuti blueprint. Kolom ORM Python `ProcessingArtifact.artifact_metadata` dipetakan ke nama database `metadata`, karena `metadata` merupakan atribut khusus pada declarative SQLAlchemy.
- ID menggunakan `BIGINT` di PostgreSQL. Model memakai `INTEGER` saat SQLite untuk menjaga perilaku autoincrement pada test.
- Migration target utama adalah PostgreSQL 15+. Unit test model menggunakan SQLite in-memory; migration PostgreSQL tetap harus diuji pada instance PostgreSQL sebelum deployment.
- Belum ada data penelitian yang dimasukkan. Belum ada hasil DBSCAN yang dibuat pada fase ini.
- Tidak ada data yang dibersihkan, diubah, atau diimpor pada fase ini.

## Menjalankan migration

Pastikan `.env` sudah berisi `DATABASE_URL` yang benar dan PostgreSQL berjalan.

```bash
flask --app 'app:create_app' db upgrade
flask --app 'app:create_app' db current
```

Untuk memeriksa revision:

```bash
flask --app 'app:create_app' db heads
```

Jangan menjalankan `db downgrade` pada database berisi data penelitian tanpa backup dan persetujuan eksplisit.

## Membuat migration lanjutan

Setelah mengubah model:

```bash
flask --app 'app:create_app' db migrate -m "describe schema change"
```

Tinjau file migration yang dihasilkan sebelum menjalankan `db upgrade`. Jangan menganggap autogenerate selalu memahami perubahan constraint atau index secara sempurna.

## Pengujian

```bash
pytest -q
```

Test fase ini memeriksa registrasi sepuluh tabel, kemampuan `create_all()` pada SQLite, dan sebagian check constraint. PostgreSQL integration test masih perlu dijalankan pada lingkungan PostgreSQL aktual.

## Pemeriksaan yang sudah dilakukan pada paket ini

- `python -m compileall -q .`: lulus.
- Registrasi metadata SQLAlchemy: sepuluh tabel terdaftar.
- Pembuatan seluruh tabel model pada SQLite in-memory: lulus.
- Check constraint `users.role`: diuji dan menolak role di luar `admin`.
- Check constraint koordinat `gempa_processed.latitude`: diuji dan menolak latitude 100.
- Kompilasi Alembic revision menjadi DDL PostgreSQL melalui mock dialect: lulus; seluruh sepuluh perintah `CREATE TABLE`, partial index run aktif, dan composite FK job-run ditemukan.

Batas verifikasi: dependency Flask dan Flask-SQLAlchemy tidak tersedia pada lingkungan build ini, dan instalasi paket tidak dapat dilakukan karena akses package index tidak tersedia. Karena itu `pytest -q`, perintah `flask db upgrade` terhadap PostgreSQL nyata, dan integration test PostgreSQL belum dijalankan. Jalankan ketiganya di lingkungan lokal setelah memasang `requirements.txt`.
