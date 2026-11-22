# SEISMAP BE 4.1.3 — T3 Epsilon Candidate Union

## Isi paket

- `services/parameter_search_service.py`
- `tasks/parameter_search_task.py`
- `routes/admin_datasets.py`, `routes/admin_jobs.py`
- `services/job_lifecycle_service.py`
- `config.py`
- unit, functional, dan integration tests untuk T3
- `docs/T3_EPSILON_CANDIDATE_METHOD_4.1.3.md`
- `docs/FRONTEND_HANDOFF_T3_4.1.3.md`
- `docs/CHANGELOG_4.1.3.md`

## Perubahan metode

Kandidat epsilon sekarang merupakan gabungan kumulatif dari:

1. Knee sensitivity untuk setiap MinPts.
2. `eps_candidates_km` eksplisit dari request.
3. Default grid `[10, 15, 20, 25, 30, 40, 50, 60, 75, 100]` km.

Nilai dibulatkan ke kelipatan 0,5 km dengan `ROUND_HALF_UP`, dideduplikasi, dan setiap nilai unik menyimpan seluruh asalnya. Provenance menggunakan format `knee:minpts=10:+10%`, `grid`, dan `explicit`. Semua epsilon kemudian diuji silang dengan semua MinPts.

**Perubahan perilaku penting:** pada implementasi sebelumnya, jika `eps_candidates_km` eksplisit dikirim, kandidat eksplisit menggantikan Knee sensitivity. Mulai 4.1.3, kandidat eksplisit bersifat tambahan dan digabung dengan Knee sensitivity serta default grid. Nilai epsilon eksplisit harus finite, lebih besar dari 0 km, dan tidak melebihi 1.000 km. Job lama (termasuk Job 41) tidak dimodifikasi dan tidak dihitung ulang.

Jika Knee tidak ditemukan untuk sebagian MinPts, hanya sumber Knee untuk MinPts tersebut yang dilewati; kandidat dari MinPts lain, explicit, dan grid tetap digunakan. Jika seluruh sumber kosong, job berstatus `FAILED` dengan pesan `Tidak ada kandidat epsilon...`, bukan sukses dengan nol eksperimen.

Konfigurasi efektif dan kandidat final disimpan pada `processing_jobs.input_payload.parameter_search_metadata`, meliputi `default_grid`, `rounding_km`, `use_default_grid`, `combination_mode`, `epsilon_candidates_km`, `knee_not_found`, serta jumlah kandidat dan kombinasi. Log job mencatat jumlah kombinasi yang akan diuji. `eps_radian` dihitung dari nilai `eps_km` yang sudah dibulatkan.

Request opsional baru: `use_default_grid` (boolean). Default `true`; dapat diubah melalui konfigurasi.

Setiap eksperimen menyimpan provenance di `evaluation_metadata.parameter_search.eps_sources`. Artefak JSON menyimpan daftar kandidat dan asalnya pada `search_configuration`.

## Versi

- Versi implementasi/metode: `4.1.3`
- T2 p95 tetap dipertahankan.
- Tidak ada perubahan skema database dan tidak memerlukan migrasi.
- Tidak mengubah KNN, Haversine, DBSCAN, atau Silhouette.
- Kontrak API lama dipertahankan; request baru bersifat opsional. Response detail Job menambahkan `parameter_search_metadata` sebagai field additive untuk audit konfigurasi dan kandidat final.

## Penerapan (ZIP + Terminal, tanpa Git)

Jalankan dari root `BE 4.1` dengan `.venv` aktif.

### 1. Backup file yang akan ditimpa

```bash
BACKUP="../BACKUP_BE41_T3_4.1.3_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP"
for FILE in \
  services/parameter_search_service.py \
  tasks/parameter_search_task.py \
  routes/admin_datasets.py \
  routes/admin_jobs.py \
  services/job_lifecycle_service.py \
  config.py \
  tests/unit/test_elbow_calculation.py \
  tests/unit/test_epsilon_candidate_generation.py \
  tests/service_functional/test_epsilon_provenance.py \
  tests/service_functional/test_job_lifecycle.py \
  tests/integration/test_api_workflow.py
do
  mkdir -p "$BACKUP/$(dirname "$FILE")"
  cp "$FILE" "$BACKUP/$FILE"
done
```

### 2. Ekstrak patch

```bash
unzip -o ~/Downloads/SEISMAP_BE41_T3_EPSILON_MERGE_4.1.3.zip -d .
```

### 3. Compile dan test bertahap

```bash
python -m compileall -q services tasks routes tests

python -m pytest -q tests/unit/test_epsilon_candidate_generation.py tests/unit/test_elbow_calculation.py

python -m pytest -q tests/service_functional/test_epsilon_provenance.py tests/service_functional/test_job_lifecycle.py

python -m pytest -q
```

## Status verifikasi paket

- Compileall pada source paket: lulus.
- Isolated logic smoke test revisi T3: 6/6 skenario lulus.
- Full pytest dan integration test harus dijalankan di virtual environment BE lokal karena runtime penyusunan paket tidak memiliki Flask/Celery/kneed dan akses instalasi dependensi eksternal.
