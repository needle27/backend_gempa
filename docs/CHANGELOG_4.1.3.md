# Changelog — SEISMAP BE 4.1.3

## T3 — Penggabungan kandidat epsilon

- Menggabungkan Knee sensitivity, `eps_candidates_km` eksplisit, dan default grid secara kumulatif.
- Mengubah perilaku lama: epsilon eksplisit sebelumnya menggantikan Knee sensitivity; pada 4.1.3 epsilon eksplisit menjadi sumber tambahan.
- Menambahkan provenance lengkap: `knee:minpts={MinPts}:{persentase:+g}%`, `grid`, dan `explicit`.
- Membulatkan dengan `ROUND_HALF_UP` ke kelipatan `rounding_km`, lalu deduplikasi dan mengurutkan kandidat.
- Menghitung `eps_radian` dari `eps_km` yang telah dibulatkan.
- Menolak epsilon eksplisit yang tidak finite, <= 0 km, atau > 1.000 km pada route dengan HTTP 422.
- Mencatat MinPts yang tidak memiliki knee dalam `knee_not_found`; kegagalan knee parsial tidak menghentikan sumber lain.
- Menggagalkan job dengan pesan yang jelas jika tidak ada kandidat epsilon sama sekali.
- Menyimpan konfigurasi efektif, daftar kandidat final, dan jumlah kombinasi di metadata job.
- Menyertakan konfigurasi yang dibekukan dalam parameter task agar pause/resume/restart memakai konfigurasi awal.
- Mempertahankan mode `cross`: seluruh kandidat epsilon dikombinasikan dengan seluruh MinPts.
- Job historis, termasuk Job 41, tidak dimodifikasi dan tidak dihitung ulang.

## Kompatibilitas

- Semua field request lama tetap diterima.
- `use_default_grid` tetap opsional dan default-nya mengikuti konfigurasi server (`true` secara default).
- Tidak ada migrasi database.
- Field API baru hanya bersifat tambahan.
