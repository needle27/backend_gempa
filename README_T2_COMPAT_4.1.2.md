# SEISMAP BE 4.1.2 — T2 Compatibility Correction

## Tujuan

Memperbaiki regresi kompatibilitas pada paket T2 4.1.1. Paket sebelumnya mengganti seluruh `parameter_search_service.py` dengan snapshot source yang lebih lama dan menghilangkan integrasi `ClusteringEvaluationService`. Akibatnya, `evaluation_metadata["metrics"]` tidak tersimpan pada eksperimen.

## Perubahan

- Mempertahankan seluruh metode T2 p95: kurva K-distance lengkap, p90/p95/p98, prefix p95 untuk KneeLocator, dan pemetaan indeks Knee 1-based.
- Memulihkan integrasi `ClusteringEvaluationService` yang sudah digunakan sebelum T2.
- Mengembalikan `evaluation_metadata` dengan `metrics` yang hanya berisi `silhouette`.
- Mempertahankan `dbi_score` dan `dbcv_score` sebagai `None` untuk kompatibilitas model/API.
- Memulihkan validasi rentang latitude dan longitude.
- Tidak mengubah database, migration, route, atau kontrak API.

## Versi

- Paket koreksi kode: `4.1.2`
- Versi metode T2 yang ditulis ke metadata: `4.1.1` (algoritma p95 tidak berubah dari T2 4.1.1).

## Penerapan (ZIP + Terminal, tanpa Git)

Jalankan dari root project BE 4.1 dengan `.venv` aktif:

```bash
unzip -o ~/Downloads/SEISMAP_BE41_T2_COMPAT_4.1.2.zip -d .
python -m compileall -q services tests
python -m pytest -q tests/unit/test_elbow_calculation.py
python -m pytest -q
```

## Verifikasi yang diharapkan

Objek eksperimen kembali memiliki:

```python
experiment.evaluation_metadata["metrics"]
```

Dengan key aktif tepat `silhouette`. Evaluasi DBI dan DBCV tetap nonaktif.
