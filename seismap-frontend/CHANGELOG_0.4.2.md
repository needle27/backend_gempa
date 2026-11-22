# SEISMAP Frontend v0.4.2 — Job Management

## Added
- Halaman Admin Job Management pada route `/admin/jobs`.
- Integrasi `GET /api/admin/jobs` dengan query `page`, `limit`, `status`, `job_type`, dan `dataset_id`.
- Filter, pagination, ringkasan status, auto-refresh untuk job QUEUED/RUNNING, dan panel detail job.
- Pengambilan hasil eksperimen melalui `GET /api/admin/jobs/{job_id}/experiments`.
- Aksi meneruskan job Parameter Search yang SUCCESS ke DBSCAN Final tanpa mengulang pencarian.

## Preserved
- Endpoint detail job `GET /api/admin/jobs/{job_id}`.
- Kontrak Final DBSCAN hanya mengirim `experiment_id`; tidak ada `depth_thresholds_km`.
- Tema Dark Glassmorphism dan pemisahan preview fixture dari API aktual.

## Notes
- Pilihan dataset dan job Parameter Search disimpan di `sessionStorage` agar bertahan setelah refresh pada tab browser yang sama.
- Response parser menerima `data` berupa array atau object daftar (`items`, `jobs`, `results`, atau `data`) dan membaca metadata pagination dari `meta`/`pagination`. Jika response BE memakai bentuk lain, sesuaikan adapter `getJobs` berdasarkan response aktual.
- Runtime API belum diuji dari lingkungan pembuatan ZIP; verifikasi harus dilakukan pada backend BE 4.1 yang sedang berjalan.
