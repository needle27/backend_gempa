# Elbow Analysis — Frontend QA Checklist

Gunakan backend BE 4.1 yang sudah menjalankan integrasi artefak Elbow. Seluruh pengujian membutuhkan sesi admin yang valid.

## 1. Alur halaman

- [ ] Jalankan Pencarian Parameter pada dataset berstatus siap.
- [ ] Pastikan panel Analisis K-Distance muncul setelah job berstatus `SUCCESS`.
- [ ] Dari Manajemen Proses, buka job `PARAMETER_SEARCH` lama yang berstatus `SUCCESS` dan pilih **Buka Analisis K-Distance**.
- [ ] Pastikan job dan dataset yang dibuka sesuai dengan baris job yang dipilih.
- [ ] Job historis tanpa artefak menampilkan informasi artefak belum tersedia, bukan grafik atau nilai buatan.

## 2. Comparison View

- [ ] Ringkasan kurva berasal dari `GET /api/admin/jobs/{job_id}/elbow`.
- [ ] Setiap kandidat MinPts mengambil detail menggunakan `detail_url` dari response.
- [ ] Kurva menggunakan `preview_points` dari backend.
- [ ] Tooltip menampilkan urutan titik dan jarak dalam kilometer.
- [ ] Knee marker hanya tampil jika `knee_detected` benar dan `knee_rank` tersedia dari metadata.
- [ ] Kartu MinPts membuka Detail Kurva kandidat tersebut.
- [ ] Unduhan grafik perbandingan menggunakan `comparison_plot_url` dari response.

## 3. Detail View

- [ ] Dropdown dapat memilih setiap kandidat MinPts.
- [ ] Grafik menampilkan titik preview, sumbu rank, dan jarak (km).
- [ ] Garis epsilon dan penanda Knee hanya tampil jika Knee terdeteksi oleh backend.
- [ ] Jika Knee tidak ditemukan, tampilkan `Knee Point Not Detected`; jangan membuat nilai epsilon pengganti.
- [ ] Informasi konfigurasi pencarian ditampilkan sebagai label, bukan JSON mentah.
- [ ] Tabel eksperimen menampilkan epsilon yang benar-benar diuji untuk MinPts yang sama.
- [ ] Unduhan PNG, CSV, dan JSON memakai URL artefak dari response ringkasan.

## 4. Autentikasi dan unduhan

- [ ] Semua request API menggunakan cookie JWT.
- [ ] Request unduhan memakai `credentials: include`.
- [ ] HTTP 401 memicu satu kali refresh sesi, lalu mengulang unduhan.
- [ ] URL artefak dari host di luar API origin ditolak.
- [ ] PNG, CSV, dan JSON tersimpan dengan ekstensi yang sesuai.

## 5. Responsif dan visual

- [ ] Desktop: kurva perbandingan dan detail dapat dibaca tanpa konten keluar dari card.
- [ ] Tablet: kartu ringkasan menyesuaikan dua kolom.
- [ ] Mobile 320–620 px: grafik, tab, dropdown, dan tombol unduh tidak saling menimpa.
- [ ] Legend dapat membungkus ke baris berikutnya.
- [ ] Tabel eksperimen menggunakan scroll horizontal di dalam pembungkus tabel.
- [ ] Tooltip tidak menutupi atau keluar dari batas card.

## 6. Batas metodologi

- [ ] Tidak ada perhitungan KNN, Knee, epsilon, atau DBSCAN di frontend.
- [ ] Tidak ada perubahan payload Final DBSCAN; request tetap hanya `experiment_id`.
- [ ] Magnitudo, kedalaman, waktu, dan lokasi tidak ditambahkan sebagai fitur clustering.
