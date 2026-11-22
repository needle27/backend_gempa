# Frontend Handoff — Parameter Search T3 (BE 4.1.3)

## Request

Endpoint parameter search menerima field opsional:

```json
{
  "use_default_grid": true
}
```

- `true`: kandidat default grid ikut digabung.
- `false`: default grid tidak ditambahkan; Knee sensitivity dan explicit request tetap diproses.
- field tidak dikirim: backend memakai `EPSILON_USE_DEFAULT_GRID` (default `true`).
- tipe selain boolean menghasilkan HTTP 422.
- `eps_candidates_km` eksplisit harus finite, > 0 km, dan <= 1.000 km; selain itu route mengembalikan HTTP 422 dengan pesan validasi.

Field request lama tetap didukung.

## Sumber epsilon

Backend menggabungkan `eps_knee_km` per MinPts dengan `sensitivity_percentages`, `eps_candidates_km` dari request, dan default grid. Kandidat dibulatkan ke kelipatan `EPSILON_ROUNDING_KM` (default 0.5 km), lalu dideduplikasi.

Kombinasi parameter menggunakan mode silang: setiap epsilon unik diuji dengan setiap kandidat MinPts.

## Provenance eksperimen

Untuk T3, frontend dapat membaca:

`experiment.evaluation_metadata.parameter_search.eps_sources`

Contoh:

```json
{
  "evaluation_metadata": {
    "parameter_search": {
      "method_version": "4.1.3",
      "eps_sources": ["grid", "knee:minpts=10:+10%"],
      "epsilon_rounding_km": 0.5,
      "combination_mode": "cross"
    }
  }
}
```

Job detail API juga menyediakan `parameter_search_metadata`, termasuk `default_grid`, `rounding_km`, `use_default_grid`, `combination_mode`, `epsilon_candidates_km`, `knee_not_found`, `epsilon_candidate_count`, dan `combination_count`. Field lama tetap dipertahankan. Field langsung `experiment.eps_sources` merupakan pekerjaan kontrak API additive berikutnya.

## Artefak Knee

JSON artefak kurva menyimpan konfigurasi gabungan pada `search_configuration`, termasuk `epsilon_candidates`, `candidate_count_before_deduplication`, `candidate_count_after_deduplication`, `source_candidate_counts`, dan `combination_mode`.
