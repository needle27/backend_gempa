# SEISMAP Frontend 0.4.10 — Chart Readability Refinement

## Perubahan tampilan

- Grafik jumlah anggota per klaster menyediakan pilihan skala linear dan logaritmik agar batang klaster kecil tetap dapat dibandingkan saat rentang jumlah anggota sangat lebar.
- Grafik komposisi klaster menampilkan enam klaster terbesar dan menggabungkan profil sisanya ke kategori "Klaster lainnya". Proporsi dihitung terhadap seluruh anggota profil. Rincian ditampilkan pada daftar di samping donut sehingga tooltip tidak menutupi angka di tengah grafik.
- Grafik profil kedalaman menyediakan mode jumlah dan persentase (100% per klaster), tanpa mengubah nilai sumber.
- Grafik rata-rata magnitudo dan rata-rata kedalaman dipisahkan menjadi dua grafik dengan skala masing-masing.
- Kontrol grafik, daftar komposisi, dan grafik mini disesuaikan untuk layar sempit serta navigasi keyboard.

## Batas perubahan

- Hanya frontend dan penyajian visual.
- Tidak ada perubahan endpoint, payload API, database, algoritma DBSCAN, atau data sumber.
- Tidak ada dependency baru.

## Verifikasi

- Perlu menjalankan `npm run typecheck && npm run build` pada environment proyek.
- Perlu pemeriksaan visual desktop dan mobile, khususnya mode logaritmik, mode persentase, donut, dan tooltip grafik mini.
