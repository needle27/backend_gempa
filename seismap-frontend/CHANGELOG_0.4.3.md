# SEISMAP Frontend v0.4.3 — Final DBSCAN Workflow Refinement

## Added
- Panel alur Final DBSCAN dan tautan langsung ke Job Management.
- Verifikasi job sumber: harus `PARAMETER_SEARCH`, `SUCCESS`, dan berasal dari dataset yang dipilih.
- Validasi silang setiap eksperimen terhadap `dataset_id` dan `job_id` sumber.
- Ringkasan eksperimen terpilih: epsilon, MinPts, jumlah klaster, noise, dan Silhouette.
- Pemulihan pemantauan job Final DBSCAN setelah refresh melalui `sessionStorage`.
- Tautan ke Riwayat Run setelah job final berstatus `SUCCESS`.

## Changed
- Mengganti dataset menghapus referensi Parameter Search sebelumnya agar eksperimen lintas dataset tidak dapat dipakai tanpa pemilihan ulang.
- Job Final DBSCAN `QUEUED`/`RUNNING` mencegah pengiriman final run lain dari halaman yang sama.
- Jika status job final tidak dapat diverifikasi, tombol eksekusi ditahan sampai pengguna memeriksa Job Management. Melepas pemantauan lokal memerlukan konfirmasi eksplisit dan tidak membatalkan proses backend.
- Parameter Search mengosongkan hasil eksperimen tampilan ketika referensi job dihapus.

## Preserved
- API request final tetap hanya `{"experiment_id": <id>}`.
- Haversine dan fitur clustering latitude/longitude.
- Kedalaman hanya untuk profiling pascaklasterisasi.
- Tema Dark Glassmorphism, autentikasi cookie/CSRF, dan pemisahan preview fixtures dari API aktual.

## Verification
- Source review dan TypeScript/build checks dilakukan pada paket rilis; hasil aktual dicatat pada pesan penyerahan.
