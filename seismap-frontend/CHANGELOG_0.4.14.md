# SEISMAP Frontend 0.4.14

## Peta Klaster — seluruh titik sekaligus
- Menghapus navigasi pagination dari tampilan Peta Klaster.
- Frontend mengambil seluruh titik secara otomatis melalui beberapa request API.
- Setiap request menggunakan limit maksimum 5.000 sesuai kontrak API.
- Seluruh hasil request digabung dan ditampilkan dalam satu peta.
- Filter klaster, Noise, legenda, zoom, dan drag peta tetap tersedia.
- Tidak mengubah endpoint maupun kontrak Backend.
- Catatan jumlah titik yang berhasil dimuat ditampilkan di bawah legenda.
