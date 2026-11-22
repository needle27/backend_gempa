# SEISMAP Frontend v0.4.25

## Perbaikan kedipan halaman Manajemen Proses
- Polling daftar proses tetap berjalan setiap 5 detik saat ada job aktif.
- Data daftar terakhir dipertahankan selama request refresh berjalan.
- State loading penuh hanya ditampilkan saat data pertama kali dimuat.
- Jika refresh gagal, data terakhir tetap ditampilkan disertai pemberitahuan ringan.
- Menambahkan indikator pembaruan kecil tanpa mengganti tabel.
- Tidak mengubah endpoint, payload, interval polling, atau backend.
