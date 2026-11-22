# SEISMAP Frontend 0.4.20

## Perbaikan daftar gempa dan pergantian kategori
- Mengganti daftar kartu bertumpuk menjadi tabel dengan kolom magnitudo, waktu kejadian, lokasi, kedalaman, dan koordinat.
- Header tabel sticky, lebar kolom terkontrol, dan scroll horizontal pada layar kecil.
- Pergantian kategori dilakukan melalui state React dan permintaan data asynchronous; tidak melakukan full page reload.
- Mempertahankan komponen peta tetap terpasang ketika kategori berganti agar instance peta tidak diinisialisasi ulang.
- Saat kategori sedang dimuat, data sebelumnya tetap tampil disertai indikator pembaruan; halaman tidak diganti oleh layar loading penuh.
- Menggunakan nomor versi request agar respons kategori lama yang datang terlambat tidak menimpa data kategori yang sedang dipilih.
- Mempertahankan interval pembaruan otomatis lima menit.
