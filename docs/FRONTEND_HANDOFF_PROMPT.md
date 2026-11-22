# Prompt Handoff Frontend SeisMap — Konsumsi API Evaluasi

Anda bertugas memperbarui frontend SeisMap. Backend dan API adalah sumber
kebenaran. Jangan mengubah backend, database, API contract, atau menghitung
ulang metrik di browser.

## Tujuan

Tampilkan hasil evaluasi clustering yang sekarang disediakan backend:

- Silhouette Score (`silhouette_score`)
- Davies-Bouldin Index (`dbi_score`)
- DBCV (`dbcv_score`)
- Metadata evaluasi (`evaluation_metadata`)
- Jumlah klaster, jumlah noise, dan persentase noise

## API yang digunakan

1. `GET /api/admin/jobs/{job_id}/experiments`
   - Ambil metrik setiap kombinasi epsilon dan MinPts.
   - Field evaluasi tersedia langsung pada setiap item eksperimen.
2. `GET /api/admin/datasets/{dataset_id}/runs`
   - Ambil metrik untuk riwayat final run.
3. `GET /api/admin/runs/{run_id}`
   - Ambil detail final run dan eksperimen terpilih.
4. `GET /api/admin/jobs/{job_id}/elbow`
   - Ambil daftar kurva dan `upper_tail_plot_url`.
5. `GET /api/admin/jobs/{job_id}/elbow/{min_samples}`
   - Ambil metadata kurva, persentil, sensitivitas Knee, dan link artefak.
6. `GET /api/admin/jobs/{job_id}/elbow/{min_samples}/artifact?kind=upper_tail`
   - Unduh/lihat grafik audit distribusi 100%, 10% terakhir, dan 1% terakhir.
7. Endpoint publik `GET /api/summary` dan `GET /api/metadata`
   - Ambil metrik pada run aktif yang dipublikasikan.

## Aturan tampilan

- Jangan mengubah `null` menjadi `0`.
- Jika skor `null`, tampilkan status `Belum dapat dihitung` dan alasan dari
  `evaluation_metadata.metrics.{metric}.reason`.
- Tampilkan `sample_size`, `distance_metric`, `method`, `random_state`, dan
  `overall_status` dari metadata sebagai detail/tooltip.
- Jelaskan bahwa Silhouette menggunakan Haversine dan sampel stratified.
- Jelaskan bahwa DBI memakai Euclidean chord distance pada representasi
  koordinat 3-D unit sphere; jangan menyebutnya DBI Haversine.
- Jelaskan bahwa DBCV memakai Haversine mutual-reachability MST dan dapat
  berbasis sampel maksimum 2.000 titik.
- Noise label `-1` sudah dikeluarkan oleh backend dari metrik internal.
- Jangan hitung ulang Silhouette, DBI, DBCV, KNN, Knee, atau epsilon di FE.
- Epsilon dari Kneedle adalah kandidat, bukan otomatis parameter final.
- Untuk grafik upper-tail, gunakan URL yang diberikan API. Jangan menghitung
  ulang Knee dari preview atau potongan 10%/1%.

## Hasil yang diharapkan

Halaman Parameter Search dan Final DBSCAN menampilkan tiga metrik evaluasi,
status ketersediaan, jumlah klaster/noise, serta detail metodologi yang
bersumber dari API. Halaman Elbow menyediakan grafik upper-tail tanpa
mengubah data atau perhitungan backend. Pertahankan seluruh alur dan desain
frontend yang sudah ada; ubah hanya komponen yang diperlukan untuk konsumsi
field baru.
