# SEISMAP Frontend v0.4.8

## Job Lifecycle Control

- Menambahkan kontrol Jeda, Lanjutkan, Hentikan, dan Mulai Ulang pada panel proses di Pencarian Parameter, DBSCAN Final, dan Manajemen Proses.
- Menambahkan status `PAUSE_REQUESTED`, `PAUSED`, dan `STOP_REQUESTED` pada model, badge, filter, serta tampilan status.
- Memperbarui polling detail Job agar terus berjalan selama status `QUEUED`, `RUNNING`, `PAUSE_REQUESTED`, atau `STOP_REQUESTED`; polling normal berhenti setelah `PAUSED` atau status terminal. Setelah Resume/Stop dari status PAUSED, FE melakukan pemeriksaan transisi terbatas hingga 60 detik.
- Semua aksi menggunakan `POST` tanpa request body dan memanfaatkan cookie JWT, `credentials: include`, serta CSRF token dari API client yang sudah ada.
- Resume mempertahankan Job ID yang sama. Restart berpindah ke Job ID baru dan menampilkan relasi `parent_job_id`; Job sebelumnya tetap berada di riwayat.
- Menampilkan keterangan bahwa Pause bersifat kooperatif dan menunggu checkpoint aman, termasuk perilaku khusus Final DBSCAN saat `DBSCAN.fit_predict` sedang berjalan.
- Menangani `404 NOT_FOUND`, `409 JOB_LIFECYCLE_CONFLICT`, dan `500 JOB_LIFECYCLE_FAILED` tanpa menampilkan JSON mentah.
- Tidak mengubah kontrak Parameter Search, Final DBSCAN, ataupun visualisasi K-Distance & Elbow.

## Catatan kontrak

Dokumen `docs/contracts/FRONTEND_JOB_LIFECYCLE_HANDOFF.md` disertakan sebagai referensi integrasi. Kelayakan restart divalidasi oleh backend; jika backend mengembalikan `409 JOB_LIFECYCLE_CONFLICT`, kontrol Restart disembunyikan untuk Job tersebut.
