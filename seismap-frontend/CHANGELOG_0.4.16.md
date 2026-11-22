# SEISMAP Frontend 0.4.16

## Perbaikan rendering peta Gempa Terkini
- Menambahkan sinkronisasi ukuran Leaflet dengan ukuran container melalui ResizeObserver.
- Memanggil invalidateSize pada frame render berikutnya dan saat viewport berubah.
- Menjalankan fitBounds setelah ukuran peta stabil.
- Mengoptimalkan pembaruan tile saat zoom dan mempertahankan tile buffer.
- Menampilkan pemberitahuan jika tile gagal dimuat.
- Tidak mengubah sumber data, endpoint, maupun alur halaman.
