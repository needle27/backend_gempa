# SEISMAP Frontend 0.4.13

## Stabilitas navigasi Peta Klaster
- Mempertahankan halaman peta dan MapContainer tetap terpasang saat berpindah halaman titik.
- StatePanel loading penuh hanya ditampilkan saat data awal belum tersedia.
- Saat halaman berikutnya dimuat, titik dari halaman sebelumnya tetap terlihat hingga data baru tersedia.
- Menampilkan status pemuatan pada keterangan pagination.
- Mencegah layout peta hilang sementara yang menyebabkan halaman terasa restart dan scroll kembali ke atas.
