# SEISMAP Frontend v0.4.30

## Integrasi metadata Parameter Search BE 4.1.3/4.1.4
- Membaca `parameter_search_metadata` dari detail job.
- Menampilkan konfigurasi grid, sensitivitas, jumlah kandidat, status kandidat, mode kombinasi, versi metode, dan pembulatan.
- Membaca provenance eksperimen dari `evaluation_metadata.parameter_search`.
- Nested metadata diprioritaskan; field langsung lama menjadi fallback historis.
- Tidak mengubah validasi `is_valid`, rekomendasi `is_recommended`, epsilon, maupun request API.
- Memperbarui `docs/contracts/BE_4.1_API_CONTRACT.md` dengan lokasi JSON, tipe, contoh, pemetaan UI, dan aturan null/historis.
