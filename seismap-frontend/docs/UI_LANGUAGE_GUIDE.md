# Panduan Bahasa Antarmuka SEISMAP

## Prinsip
1. Bahasa Indonesia menjadi bahasa utama pada seluruh halaman publik dan admin.
2. Gunakan kalimat singkat, jelas, dan berorientasi pada tindakan pengguna.
3. Hindari menampilkan nama endpoint, payload, kode status, kode kesalahan, nama field database, atau objek JSON mentah kepada pengguna.
4. Istilah teknis dipertahankan jika merupakan istilah baku atau umum dalam konteks geospasial dan data mining.
5. Jika istilah teknis diperlukan, berikan penjelasan singkat pada kemunculan pertama.

## Istilah yang dipertahankan
- DBSCAN
- Haversine
- KNN
- K-Distance
- Knee Point (titik Knee)
- Elbow Analysis
- Epsilon
- MinPts
- Noise (dijelaskan sebagai titik yang tidak masuk ke klaster)
- Silhouette Score
- Dataset
- CSV
- API
- WebGIS
- Jupyter Notebook
- BMKG
- Latitude dan Longitude
- Cache (pada informasi teknis status penyimpanan sementara)

## Padanan antarmuka
| Istilah internal/Inggris | Label antarmuka |
|---|---|
| Dashboard | Dasbor |
| Job Management | Manajemen Proses |
| Run History | Riwayat Eksekusi |
| Audit Log | Log Aktivitas |
| Parameter Search | Pencarian Parameter |
| Comparison View | Tampilan Perbandingan |
| Detailed View | Tampilan Detail |
| Knee Point Not Detected | Titik Knee tidak terdeteksi |
| Final Clustering | Klasterisasi Final |
| Success | Berhasil |
| Failed | Gagal |
| Queued | Dalam antrean |
| Running | Sedang berjalan |
| Valid | Valid |
| Invalid | Tidak valid |
| Recommended | Direkomendasikan |
| Progress | Kemajuan |
| Refresh | Muat ulang |
| Upload | Unggah |
| Details | Rincian |
| Cluster | Klaster |

## Penyajian rincian data
- Jangan menampilkan respons API atau objek JSON mentah.
- Gunakan label yang mudah dipahami dan format tanggal/angka lokal Indonesia.
- Jangan tampilkan token, cookie, password, user-agent, sidik file, atau kode kesalahan internal pada rincian umum.
- Jika informasi teknis diperlukan untuk audit, tampilkan sebagai rincian terstruktur dan dapat dibuka, bukan sebagai JSON mentah.
- Pesan kesalahan harus menjelaskan masalah dan tindakan berikutnya, bukan hanya menampilkan kode internal.
