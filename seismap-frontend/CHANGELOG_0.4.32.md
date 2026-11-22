# SEISMAP Frontend v0.4.32

## Fix konsistensi provenance Parameter Search
- Menambahkan resolver provenance bersama `src/utils/parameterSearchMetadata.ts`.
- Resolver digunakan oleh tabel Hasil Eksperimen dan tabel eksperimen pada ElbowAnalysisPanel.
- Meneruskan `parameter_search_metadata` dari detail job ke ElbowAnalysisPanel.
- Provenance dicari berdasarkan kecocokan `eps_km` terhadap `epsilon_candidates[].eps_km` dengan toleransi 1e-9.
- Sumber kandidat dipertahankan verbatim, termasuk MinPts asal dan sensitivitas (contoh `knee:minpts=8:-20%`), tidak diganti berdasarkan MinPts eksperimen.
- Nested experiment metadata diprioritaskan, kemudian legacy experiment fields, lalu metadata kandidat/job.
- Menambahkan kolom Sumber epsilon, Pembulatan, dan Versi metode ke tabel eksperimen per MinPts.
- Tidak mengubah endpoint, algoritma, nilai evaluasi, validitas, atau rekomendasi backend.
