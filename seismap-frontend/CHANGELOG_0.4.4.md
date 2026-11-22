# SEISMAP Frontend v0.4.4

## UI Language & Presentation Refinement

### Bahasa antarmuka
- Menetapkan Bahasa Indonesia sebagai bahasa utama untuk halaman publik dan admin.
- Mempertahankan istilah teknis yang umum dan diperlukan, seperti DBSCAN, Haversine, KNN, Epsilon, MinPts, Noise, Silhouette Score, Dataset, CSV, API, dan WebGIS.
- Menyeragamkan nama menu, judul halaman, label, tombol, status, pesan kosong, dan pesan proses.
- Mengganti istilah status internal seperti `SUCCESS`, `FAILED`, `QUEUED`, dan `RUNNING` dengan label yang mudah dipahami.
- Mengubah nama tahap proses seperti `KNN_DISTANCE`, `KNEE_DETECTION`, dan `PROFILING` menjadi penjelasan berbahasa Indonesia.

### Penyajian informasi
- Menghapus tampilan JSON mentah dari rincian Dataset, Validasi, Riwayat Eksekusi, dan Log Aktivitas.
- Mengganti tampilan mentah dengan daftar informasi berlabel Bahasa Indonesia.
- Menyembunyikan informasi internal atau sensitif seperti token, cookie, user-agent, sidik file, dan kode kesalahan mentah dari rincian umum.
- Menangani rincian terstruktur yang diterima sebagai objek maupun teks JSON agar tetap ditampilkan sebagai informasi yang dapat dibaca.
- Menambahkan pemetaan pesan kesalahan umum ke penjelasan Bahasa Indonesia.
- Menyeragamkan label grafik dan tooltip agar tidak menampilkan nama field internal.

### Integrasi dan metodologi
- Tidak mengubah endpoint BE 4.1.
- Tidak mengubah payload Final DBSCAN (`experiment_id`).
- Tidak mengubah algoritma DBSCAN, metrik Haversine, parameter eksperimen, maupun kategori profil kedalaman.
- Tidak mengubah autentikasi, Job Monitoring, atau alur pemilihan eksperimen langsung pada halaman DBSCAN Final.

### Pemeriksaan
- 35 file TypeScript/TSX berhasil dipindai parser TypeScript tanpa kesalahan sintaks.
- Tidak ditemukan tampilan `<pre>` atau komponen JSON mentah pada halaman.
- Typecheck dan production build tetap perlu dijalankan di lingkungan proyek karena dependensi `node_modules` tidak tersedia pada lingkungan penyusunan paket.
