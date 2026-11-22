# SeisMap — Metode Evaluasi Kualitas Klaster

## Cakupan

Backend menghitung tiga metrik untuk setiap kombinasi Parameter Search dan
mengulang evaluasi pada hasil Final DBSCAN:

1. Silhouette Score — Haversine.
2. Davies-Bouldin Index (DBI) — Euclidean chord distance pada representasi
   koordinat 3-D unit sphere.
3. Density-Based Clustering Validation (DBCV) — Haversine mutual-reachability
   distance dan minimum spanning tree (MST).

Label noise `-1` dikeluarkan dari ketiga metrik. Jumlah noise tetap disimpan
sebagai metrik hasil DBSCAN tersendiri.

## 1. Silhouette Score

- Input: latitude dan longitude dalam radian.
- Distance metric: Haversine.
- Sampel: deterministik dan stratified per klaster, maksimum 10.000 titik.
- Random state default: 42.
- Seluruh klaster non-noise dipertahankan dalam sampel selama batas sampel
  memungkinkan. Jika kondisi evaluasi tidak terpenuhi, skor `null` dan alasan
  dicatat pada `evaluation_metadata.metrics.silhouette.reason`.
- Jika seluruh titik non-noise masuk sampel, skor merupakan evaluasi exact pada
  seluruh titik non-noise. Jika tidak, skor merupakan estimasi berbasis sampel.

## 2. Davies-Bouldin Index

DBI standar berbasis Euclidean tidak boleh dihitung langsung dari pasangan
latitude-longitude mentah. Backend terlebih dahulu memetakan koordinat radian
ke koordinat kartesian 3-D pada unit sphere:

`x = cos(lat) cos(lon)`

`y = cos(lat) sin(lon)`

`z = sin(lat)`

DBI standar kemudian dihitung menggunakan centroid, rata-rata jarak anggota ke
centroid (within-cluster scatter), dan jarak Euclidean antarsentroid pada ruang
3-D tersebut. Ini adalah DBI pada spherical embedding dengan Euclidean chord
distance; bukan DBI Haversine murni. Representasi dan metriknya dinyatakan
secara eksplisit di metadata.

DBI menggunakan seluruh titik non-noise. Skor `null` jika kurang dari dua
klaster atau terdapat centroid antarklaster yang berimpit sehingga indeks
tidak terdefinisi.

## 3. DBCV

DBCV dihitung dengan implementasi mutual-reachability MST yang menggunakan
matriks jarak Haversine dalam radian.

- Dimensi spasial `d = 2`.
- `min_points = 2*d = 4`; diagonal self-distance bernilai nol sehingga indeks
  ke-4 pada baris jarak terurut adalah jarak ke tetangga ke-4 selain titik itu
  sendiri.
- Noise `-1` dikeluarkan.
- Density sparseness setiap klaster adalah bobot edge maksimum pada MST
  mutual-reachability di dalam klaster.
- Density separation antarklaster adalah minimum mutual-reachability di antara
  pasangan titik dari dua klaster.
- Validity klaster: `(separation - sparseness) / max(separation, sparseness)`.
- Skor keseluruhan adalah rata-rata berbobot ukuran klaster.

Matriks pairwise penuh untuk 59.847 titik memerlukan puluhan GB memori. Karena
itu DBCV menggunakan sampel stratified deterministik maksimum 2.000 titik.
Minimal lima titik sampel dipertahankan per klaster (self + empat tetangga).
Jika batas sampel tidak dapat mempertahankan semua klaster atau ada klaster
asli beranggota kurang dari lima, DBCV dikembalikan sebagai `null` disertai
alasan. Jika jumlah non-noise tidak melebihi batas, DBCV dihitung pada seluruh
poin non-noise.

DBCV yang memakai sampel harus ditafsirkan sebagai estimasi DBCV, bukan skor
exact seluruh dataset. Ukuran sampel dan random state disimpan dalam metadata.

## 4. Status dan kompatibilitas

- Kolom numerik `silhouette_score`, `dbi_score`, dan `dbcv_score` menyimpan
  hasil masing-masing metrik.
- `evaluation_metadata` menyimpan metode, distance metric, sample size,
  random state, status, dan alasan jika skor tidak dapat dihitung.
- `is_valid` pada eksperimen dipertahankan untuk kompatibilitas dan tetap
  mengikuti ketersediaan Silhouette Score. DBI/DBCV yang tidak tersedia tidak
  mengubah arti flag lama tersebut.
- Nilai metrik historis tidak di-backfill atau direkayasa. Job lama tetap
  memiliki nilai `null` untuk metrik yang belum pernah dihitung.
- Parameter final tidak dipilih otomatis hanya berdasarkan satu skor.

## 5. Konsistensi Parameter Search dan Final Run

Kedua proses memakai `ClusteringEvaluationService` yang sama, konfigurasi
sample maksimum yang sama, dan random state yang sama. Repository koordinat
serta repository event mengurutkan data berdasarkan ID menaik, sehingga
sampel evaluasi deterministik dapat direproduksi ketika dataset dan label
DBSCAN identik.
