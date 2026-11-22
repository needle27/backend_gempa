# SEISMAP Frontend 0.4.19

## Pembaruan otomatis Gempa Terkini
- Mengubah interval permintaan otomatis menjadi setiap 5 menit.
- Menambahkan hitung mundur MM:SS yang terlihat pada informasi pembaruan.
- Hitung mundur hanya berjalan saat tab browser aktif/terlihat.
- Saat tab kembali aktif, sistem meminta data terbaru dan mengatur ulang hitung mundur.
- Tombol pembaruan manual mengatur ulang hitung mundur menjadi 05:00.
- Tidak mengubah endpoint, kontrak API, maupun sumber data BMKG.

### Frontend refinement — realtime category navigation and list table
- Category changes now retain the current page layout and cached category data while the next request runs; the content is not replaced by a full-page loading panel when cached data exists.
- Removed the shared in-flight request lock that could cause a category change to skip its fetch when another request was still running. Latest-request versioning prevents stale responses from overwriting the selected category.
- Replaced the stacked earthquake cards in magnitude/felt categories with a horizontally scrollable, sticky-header table for magnitude, location, event time, depth, and coordinates.
- Added responsive category controls and inline refresh-error feedback while keeping the last successful data visible.
