# SEISMAP BE 4.1.3 — T3 Penggabungan Kandidat Epsilon

## Tujuan

Membangun himpunan kandidat epsilon (km) dari tiga sumber yang bersifat kumulatif:

1. Sensitivitas terhadap `eps_knee_km` setiap kandidat MinPts.
2. Kandidat eksplisit dari request `eps_candidates_km`.
3. Default grid yang dapat diaktifkan atau dinonaktifkan.

Kandidat eksplisit tidak lagi menggantikan kandidat Knee sensitivity atau default grid.

## Definisi matematis

Untuk setiap kurva MinPts ke-i dengan nilai Knee `k_i` dan setiap persentase sensitivitas `s`:

`epsilon_knee(i,s) = k_i * (1 + s/100)`

Himpunan mentah:

`E_raw = E_knee_sensitivity ∪ E_explicit ∪ E_default_grid`

Setiap nilai dibulatkan ke kelipatan presisi `q` menggunakan aturan decimal `ROUND_HALF_UP`:

`round_q(e) = q * ROUND_HALF_UP(e/q)`

Himpunan akhir:

`E = sorted(unique(round_q(e) for e in E_raw))`

Default `q = 0.5 km`. Nilai q dapat diubah melalui `EPSILON_ROUNDING_KM`.

## Default konfigurasi

```python
EPSILON_DEFAULT_GRID_KM = [10, 15, 20, 25, 30, 40, 50, 60, 75, 100]
EPSILON_ROUNDING_KM = 0.5
EPSILON_USE_DEFAULT_GRID = True
```

Environment overrides:

- `EPSILON_DEFAULT_GRID_KM=10,15,20,25,30,40,50,60,75,100`
- `EPSILON_ROUNDING_KM=0.5`
- `EPSILON_USE_DEFAULT_GRID=true`

Request field `use_default_grid` menerima boolean. Jika tidak dikirim, nilai konfigurasi `EPSILON_USE_DEFAULT_GRID` digunakan. Request lama tetap valid.

## Provenance

Setiap epsilon unik menyimpan semua sumber yang berkontribusi:

- `knee:minpts=<MinPts>:<persentase>%`, misalnya `knee:minpts=10:+10%`.
- `explicit`.
- `grid`.

Jika beberapa sumber menghasilkan nilai epsilon yang sama setelah pembulatan, nilai tersebut diuji satu kali dan semua sumber tetap dicatat. `default_grid` menyimpan daftar grid yang dikonfigurasi, sedangkan `default_grid_km` menyimpan grid yang benar-benar ditambahkan (kosong saat `use_default_grid=false`).

## Kombinasi silang

Himpunan epsilon akhir diuji silang dengan seluruh kandidat MinPts:

`C = E × M`

Dengan demikian, epsilon yang berasal dari Knee salah satu MinPts juga diuji terhadap setiap MinPts lainnya. Metadata menyimpan `combination_mode: "cross"`.

## Kondisi khusus

- Knee tidak ditemukan pada satu MinPts: hanya sumber Knee untuk MinPts tersebut yang dilewati; Knee dari MinPts lain, `explicit`, dan `grid` tetap digunakan. MinPts yang gagal dicatat pada `knee_not_found`.
- Default grid dinonaktifkan: kandidat hanya berasal dari Knee sensitivity dan `explicit`; konfigurasi default grid tetap dicatat agar keputusan dapat direproduksi.
- Tidak ada kandidat dari ketiga sumber: job berstatus `FAILED` dengan pesan eksplisit, bukan `SUCCESS` dengan nol eksperimen.
- Kandidat Knee yang tidak positif dilewati. Kandidat eksplisit harus finite, > 0 km, dan <= 1.000 km; nilai yang tidak valid ditolak route dengan HTTP 422.
- `eps_radian` dihitung dari `eps_km` yang telah dibulatkan: `eps_radian = eps_km_rounded / 6371.0088`.

## Metadata dan kontrak frontend

### Artefak JSON (`search_configuration`)

Contoh berikut bersifat sintetis untuk menjelaskan struktur metadata, bukan hasil pengujian dataset:

```json
{
  "method_version": "4.1.3",
  "epsilon_candidate_strategy": "UNION_KNEE_SENSITIVITY_EXPLICIT_GRID",
  "combination_mode": "cross",
  "rounding_km": 0.5,
  "epsilon_rounding_km": 0.5,
  "sensitivity_percentages": [-20, -10, 0, 10, 20],
  "explicit_epsilon_candidates_km": [35.0, 45.0],
  "use_default_grid": true,
  "default_grid": [10, 15, 20, 25, 30, 40, 50, 60, 75, 100],
  "default_grid_km": [10, 15, 20, 25, 30, 40, 50, 60, 75, 100],
  "epsilon_candidates_km": [10, 15, 20, 25, 30, 35, 40, 45, 50, 60, 75, 100],
  "candidate_count_before_deduplication": 12,
  "candidate_count_after_deduplication": 12,
  "source_candidate_counts": {
    "knee_sensitivity": 0,
    "explicit_request": 2,
    "default_grid": 10
  },
  "knee_not_found": [8, 10, 12, 15, 20],
  "knee_not_detected_min_samples": [8, 10, 12, 15, 20],
  "epsilon_candidates": [
    {"eps_km": 10.0, "eps_sources": ["grid"]},
    {"eps_km": 15.0, "eps_sources": ["grid"]},
    {"eps_km": 20.0, "eps_sources": ["grid"]},
    {"eps_km": 25.0, "eps_sources": ["grid"]},
    {"eps_km": 30.0, "eps_sources": ["grid"]},
    {"eps_km": 35.0, "eps_sources": ["explicit"]},
    {"eps_km": 40.0, "eps_sources": ["grid"]},
    {"eps_km": 45.0, "eps_sources": ["explicit"]},
    {"eps_km": 50.0, "eps_sources": ["grid"]},
    {"eps_km": 60.0, "eps_sources": ["grid"]},
    {"eps_km": 75.0, "eps_sources": ["grid"]},
    {"eps_km": 100.0, "eps_sources": ["grid"]}
  ]
}
```

### Metadata setiap eksperimen

Disimpan dalam kolom JSON `evaluation_metadata`:

```json
{
  "parameter_search": {
    "method_version": "4.1.3",
    "eps_sources": ["grid", "knee:minpts=10:+10%"],
    "epsilon_rounding_km": 0.5,
    "combination_mode": "cross",
    "epsilon_candidate_strategy": "UNION_KNEE_SENSITIVITY_EXPLICIT_GRID",
    "use_default_grid": true
  }
}
```

T3 menambahkan `parameter_search_metadata` pada response detail Job agar konfigurasi dan kandidat final dapat diaudit. Field eksperimen lama tetap dipertahankan; `eps_sources` tetap tersedia di `evaluation_metadata.parameter_search`. Tidak ada perubahan skema database.

## File implementasi

- `services/parameter_search_service.py`: generator, pembulatan, deduplikasi, provenance, dan metadata eksperimen.
- `tasks/parameter_search_task.py`: menggabungkan kandidat melalui generator baru sebelum menjalankan kombinasi silang.
- `routes/admin_datasets.py`: menerima opsi request `use_default_grid`.
- `config.py`: default grid, presisi pembulatan, dan default toggle.

## Pengujian

Unit test mencakup penggabungan tiga sumber, collision 49,8/50,0/50,2 km, pembulatan half-up, deduplikasi, provenance, toggle grid, Knee gagal parsial, tidak adanya kandidat, serta validasi epsilon eksplisit <= 1.000 km. Functional test memverifikasi provenance dan penggunaan epsilon bulat untuk radian. Integration test memeriksa validasi route, request lama tanpa toggle, serta metadata job.
