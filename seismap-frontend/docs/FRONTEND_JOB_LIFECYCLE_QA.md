# QA Checklist — Job Lifecycle Control (v0.4.8)

## Cakupan halaman

- [ ] Pencarian Parameter: kontrol tampil pada Job yang statusnya mendukung aksi.
- [ ] DBSCAN Final: kontrol tampil pada Job Final DBSCAN yang statusnya mendukung aksi.
- [ ] Manajemen Proses: kontrol tampil pada panel rincian Job yang dipilih.
- [ ] Job SUCCESS tidak menampilkan kontrol lifecycle.

## Matriks status

| Status | UI yang diharapkan |
|---|---|
| QUEUED | Jeda Proses, Hentikan Proses |
| RUNNING | Jeda Proses, Hentikan Proses |
| PAUSE_REQUESTED | Sedang menjeda; tanpa tombol aksi |
| PAUSED | Lanjutkan, Hentikan Proses |
| STOP_REQUESTED | Sedang menghentikan; tanpa tombol aksi |
| FAILED | Mulai Ulang jika backend menerima |
| CANCELLED | Mulai Ulang jika backend menerima |
| SUCCESS | Tanpa kontrol |

## Verifikasi API

- [ ] POST `/api/admin/jobs/{id}/pause` dikirim tanpa body dan menyertakan cookie JWT serta CSRF.
- [ ] POST `/api/admin/jobs/{id}/resume` dikirim tanpa body dan mempertahankan Job ID.
- [ ] POST `/api/admin/jobs/{id}/stop` dikirim tanpa body.
- [ ] POST `/api/admin/jobs/{id}/restart` dikirim tanpa body; FE beralih ke `id` baru yang dikembalikan backend.
- [ ] GET `/api/admin/jobs/{id}` dipolling setiap 3 detik selama QUEUED, RUNNING, PAUSE_REQUESTED, atau STOP_REQUESTED.
- [ ] Polling normal berhenti pada PAUSED dan status terminal.
- [ ] Setelah Resume/Stop dari PAUSED, FE memeriksa transisi secara terbatas hingga 60 detik.

## Verifikasi perilaku

- [ ] Pause tidak ditampilkan sebagai selesai sebelum status PAUSED.
- [ ] Resume memakai ID yang sama.
- [ ] Restart memakai ID baru dan menampilkan `parent_job_id`.
- [ ] Job sebelumnya tetap ada di daftar/riwayat.
- [ ] Final DBSCAN berstatus PAUSED tetap memblokir pengiriman Final DBSCAN duplikat.
- [ ] Kombinasi parameter tersimpan tidak diulang saat Parameter Search dilanjutkan.
- [ ] UI menjelaskan bahwa pause Final DBSCAN menunggu batas tahap aman dan dapat menghitung ulang `DBSCAN.fit_predict`.
- [ ] HTTP 404, 409, dan 500 ditampilkan sebagai pesan yang dapat dipahami; tidak menampilkan JSON mentah.

## Catatan restart

Handoff belum mendefinisikan field GET detail untuk kelayakan restart. Karena itu FE menawarkan tombol pada FAILED/CANCELLED dan tetap menjadikan backend sebagai sumber kebenaran. Jika backend mengembalikan `409 JOB_LIFECYCLE_CONFLICT`, tombol disembunyikan untuk Job tersebut dan alasan umum ditampilkan.
