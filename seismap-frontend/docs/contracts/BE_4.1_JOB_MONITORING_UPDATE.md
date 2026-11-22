# BE 4.1 — Job Monitoring API Update

Sumber pembaruan: konfirmasi tim Backend BE 4.1 yang menyatakan endpoint baru telah diimplementasikan dan diuji pada runtime.

## Endpoint

`GET /api/admin/jobs`

Query parameters yang didukung:

- `page`
- `limit`
- `status`
- `job_type`
- `dataset_id`

Frontend mengirim filter dan pagination sebagai query string.

## Endpoint terkait yang tetap digunakan

- `GET /api/admin/jobs/{job_id}` — detail/status/progress job.
- `GET /api/admin/jobs/{job_id}/experiments` — eksperimen yang dihasilkan oleh job Parameter Search.

## Hasil verifikasi yang dilaporkan Backend

- 15/15 API tests PASS.
- Admin authentication PASS.
- Pagination PASS.
- Filter status PASS.
- Filter job_type PASS.
- Filter dataset_id PASS.
- Combined filters PASS.
- Invalid query validation PASS (HTTP 422).
- Existing job detail endpoint tetap berfungsi.

Data aktual yang dilaporkan: total job 16; SUCCESS 14; PARAMETER_SEARCH 12. Angka ini adalah snapshot saat pengujian backend, bukan angka statis untuk frontend.

## Catatan integrasi

Frontend mengharapkan record job memiliki field yang sama dengan model `ProcessingJob` yang digunakan endpoint detail: `id`, `dataset_id`, `run_id`, `job_type`, `status`, `progress`, `current_step`, `message`, `error_code`, `created_at`, `started_at`, dan `finished_at`. Adapter `getJobs` menerima daftar pada `data` sebagai array atau sebagai object yang berisi `items`, `jobs`, `results`, atau `data`; metadata pagination dibaca dari `meta` atau object `pagination`. Bentuk response aktual tetap perlu dikonfirmasi melalui satu contoh response runtime jika berbeda dari pola tersebut.
