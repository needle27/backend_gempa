# SEISMAP Frontend v0.4.23

## Integrasi Parameter Search BE 4.1.3 (T3)

- Request Parameter Search mengirim `min_samples_candidates`, `sensitivity_percentages`, `eps_candidates_km` (null jika kosong), dan `use_default_grid`.
- Form menggunakan kandidat MinPts dan sensitivitas sesuai contoh integrasi BE 4.1.3; default epsilon grid dapat diaktifkan/nonaktifkan.
- Frontend tidak menghitung ulang epsilon maupun konversi radian; nilai eksperimen ditampilkan dari response backend.
- Analisis K-distance mendukung metadata percentile P90/P95/P98, metode percentile, cutoff P95, jumlah titik input Knee, indeks Knee 1-based, error deteksi, metric, earth radius, dan method version.
- Visualisasi menampilkan garis percentile dan penanda Knee/epsilon berdasarkan nilai backend.
- Kandidat epsilon ditampilkan bersama provenance dari `eps_sources_by_km`.
- Tabel eksperimen menampilkan epsilon radian, sumber epsilon, pembulatan, dan versi metode bila tersedia.
- Metadata yang tidak tersedia pada eksperimen historis ditampilkan sebagai `—`; field lama tetap didukung.
- Tidak ada perubahan endpoint, autentikasi, maupun backend.

## Verifikasi

- Pemeriksaan sintaks TypeScript/TSX pada file yang diubah: lulus.
- `npm run typecheck` dan `npm run build` belum dapat dijalankan pada lingkungan pembuatan patch karena instalasi dependency project tidak lengkap (folder `node_modules/@types` kosong); jalankan keduanya pada lingkungan frontend lokal setelah `npm install`.
