# SEISMAP Frontend 0.4.9 — Performance Refinement

## Fokus perubahan
- Route-level lazy loading untuk halaman publik dan admin.
- WebGIS menggunakan layer Leaflet langsung dengan Canvas renderer dan satu Tooltip bersama, mengurangi subtree React dan objek Tooltip per marker.
- Marker memvalidasi koordinat sebelum dirender dan tooltip meng-escape teks atribut.
- Detail Elbow dimuat bertahap dengan batas maksimum tiga request bersamaan.
- Polling detail Job dan daftar Job dihentikan sementara saat tab browser tidak terlihat, lalu dilanjutkan saat tab aktif.
- Package version dan lockfile diselaraskan ke 0.4.9.

## Kompatibilitas
- Tidak ada perubahan endpoint, payload, autentikasi, atau kontrak API.
- Tidak ada perubahan algoritma DBSCAN maupun data yang ditampilkan.
- Batas pengambilan titik WebGIS tetap mengikuti pagination API yang sudah ada.
- Interaksi tooltip marker tetap tersedia saat hover dan klik.

## Verifikasi
- Source diperiksa dari arsip frontend yang diunggah.
- Build penuh perlu dijalankan pada environment lokal karena `node_modules` tidak disertakan dalam arsip.
