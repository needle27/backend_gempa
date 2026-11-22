# SEISMAP Frontend 0.4.11

## Ringkasan Profil Klaster
- Menambahkan pagination pada tabel Ringkasan Profil Klaster.
- Default 10 baris per halaman; pilihan 10, 25, dan 50.
- Menambahkan informasi rentang baris, jumlah total klaster, dan halaman aktif.
- Menambahkan navigasi Sebelumnya/Berikutnya.
- Menggunakan pemotongan array di sisi frontend; tidak mengubah endpoint atau kontrak API.
- Halaman kembali ke halaman pertama ketika jumlah data atau ukuran halaman berubah.

## Catatan
Pagination membatasi jumlah baris DOM yang dirender pada tabel. Data profil yang sudah diterima halaman tetap berada di memori browser, dan visualisasi grafik tetap menggunakan seluruh profil.
