# SEISMAP Frontend 0.4.9 — Catatan Optimasi

## Perubahan
1. Route-level code splitting: halaman publik dan admin dimuat saat rute dibuka.
2. WebGIS: marker digambar langsung dengan Leaflet Canvas; satu Tooltip dipakai bersama untuk seluruh marker pada halaman.
3. Validasi koordinat sebelum marker digambar dan escaping HTML pada isi Tooltip.
4. Elbow: detail kurva dimuat bertahap dengan maksimal tiga request bersamaan; hasil dapat muncul progresif.
5. Job polling: polling detail dan daftar Job tidak mengirim request ketika tab browser tersembunyi dan dilanjutkan saat tab aktif.
6. Versi package dan lockfile diselaraskan ke 0.4.9.

## Batas perubahan
- Tidak ada perubahan API, endpoint, payload, autentikasi, atau kontrak Backend.
- Tidak ada perubahan algoritma DBSCAN maupun sumber data.
- Pagination WebGIS tetap mengikuti API yang sudah digunakan.
- Tooltip marker tetap dapat dibuka melalui hover dan klik.

## Verifikasi
- 38 file TypeScript/TSX lolos pemeriksaan transpile/sintaks.
- Pemeriksaan `npm run typecheck` dan `npm run build` penuh belum dijalankan karena `node_modules` tidak disertakan dalam ZIP sumber.
- Jalankan pemeriksaan tersebut di environment lokal setelah ekstraksi.
