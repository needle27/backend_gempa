# Catatan Penyempurnaan Grafik Profil Klaster — 0.4.10

## Tujuan
Meningkatkan keterbacaan grafik pada halaman Analisis Spasial tanpa mengubah data sumber, kontrak API, atau proses DBSCAN.

## Perubahan tampilan

### 1. Jumlah anggota per klaster
- Menambahkan pilihan skala `Linear` dan `Logaritmik`.
- Skala logaritmik menggunakan batas bawah 1; nilai nol tidak digambar pada mode log agar tidak menghasilkan nilai log yang tidak terdefinisi.
- Tooltip tetap menampilkan jumlah anggota aktual.

### 2. Komposisi klaster
- Profil diurutkan berdasarkan jumlah anggota hanya untuk kebutuhan penyajian grafik.
- Enam klaster dengan anggota terbanyak ditampilkan satu per satu.
- Sisa profil digabungkan menjadi kategori `Klaster lainnya (n)`.
- Proporsi setiap irisan dihitung terhadap total anggota seluruh profil, sehingga komposisi donut tetap mencakup 100% data profil.
- Rincian jumlah dan proporsi dipindahkan ke daftar di samping donut; tidak ada tooltip mengambang yang menutupi angka di tengah.
- Daftar dan irisan donut saling menyorot saat diarahkan dengan pointer atau fokus keyboard.

### 3. Profil kedalaman
- Menambahkan mode `Jumlah` dan `Persentase`.
- Mode persentase menampilkan stacked bar 100% per klaster; kategori pada klaster dengan total nol tetap bernilai nol.
- Tooltip mengikuti mode aktif.

### 4. Rata-rata magnitudo dan kedalaman
- Memisahkan kedua atribut menjadi dua grafik garis.
- Masing-masing grafik memiliki skala Y tersendiri.
- Tooltip menampilkan atribut dan satuan yang relevan.

## Batas perubahan
- Hanya `src/components/Charts.tsx`, `src/pages/public/AnalysisPage.tsx`, dan `src/styles/global.css` yang mengubah tampilan.
- Tidak ada perubahan backend, API, database, algoritma, atau struktur data sumber.
- Tidak ada dependency baru.

## Pengujian yang perlu dilakukan di environment lokal
1. `npm run typecheck`
2. `npm run build`
3. Buka halaman Analisis Spasial pada desktop dan mobile.
4. Uji Linear/Logaritmik pada grafik anggota.
5. Uji hover dan keyboard focus pada daftar komposisi donut.
6. Uji Jumlah/Persentase pada grafik kedalaman.
7. Pastikan dua grafik rata-rata tetap terbaca pada lebar desktop dan tersusun vertikal pada mobile.
