# SEISMAP Frontend 0.4.17

## Perbaikan utama peta Gempa Terkini
- Memuat stylesheet inti resmi Leaflet (`leaflet/dist/leaflet.css`) sebelum stylesheet kustom.
- Menghapus override posisi/stacking tile yang mengganggu layout pane dan tile bawaan Leaflet.
- Mempertahankan perbaikan sinkronisasi ukuran peta dan pemantauan kegagalan tile dari 0.4.16.
- Tidak mengubah API, sumber data BMKG, maupun alur penelitian DBSCAN.
