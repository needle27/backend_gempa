# SEISMAP v0.4.3 — Inline Job Selection Patch

## Tujuan
Memungkinkan admin memilih Job Parameter Search dan eksperimen langsung dari halaman DBSCAN Final, tanpa harus berpindah ke Job Management.

## File yang diubah
- `src/pages/admin/FinalDbscanPage.tsx`

## File yang diperiksa dan tidak perlu diubah
- `src/api/services.ts`: sudah menyediakan `getJobs()` dengan filter `status`, `job_type`, dan `dataset_id`, serta `getJob()` dan `getExperiments()`.
- `src/context/PipelineContext.tsx`: sudah menyimpan `parameterJobId` pada `sessionStorage` dan mengosongkannya ketika dataset berubah.

## Perilaku
1. Saat dataset dipilih, halaman mengambil daftar job dengan filter:
   - `status=SUCCESS`
   - `job_type=PARAMETER_SEARCH`
   - `dataset_id=<dataset terpilih>`
2. Admin memilih job langsung melalui dropdown di halaman DBSCAN Final.
3. Halaman memverifikasi detail job, lalu memuat eksperimen melalui `GET /api/admin/jobs/{job_id}/experiments`.
4. Hanya eksperimen VALID dari job dan dataset yang sama yang dapat dipilih.
5. Pagination daftar job menggunakan parameter `page` dan `limit`.
6. Job Management tetap tersedia sebagai halaman pemantauan/riwayat opsional, bukan langkah wajib.

## Instalasi
Ekstrak ZIP dari folder induk `BE 4.1` dengan:
`unzip -o seismap-v043-inline-job-selection-patch.zip -d seismap-frontend`

Atau salin file di dalam ZIP ke:
`seismap-frontend/src/pages/admin/FinalDbscanPage.tsx`

Kemudian jalankan:
- `npm run typecheck`
- `npm run build`

## Verifikasi yang dilakukan di workspace pembuatan patch
- TypeScript/TSX transpile syntax: 0 diagnostics.
- Pemeriksaan typecheck penuh dan runtime API harus dilakukan di proyek lokal karena dependency dan backend runtime berada di komputer pengguna.

Tidak ada perubahan pada kontrak API, algoritma DBSCAN, parameter, atau metodologi penelitian.
