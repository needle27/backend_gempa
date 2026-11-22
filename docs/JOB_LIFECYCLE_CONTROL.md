# Job Lifecycle Control — BE 4.1

## Semantik

- `Pause` bersifat cooperative. API mengubah status menjadi `PAUSE_REQUESTED`; task baru mengubahnya menjadi `PAUSED` setelah mencapai checkpoint aman.
- `Resume` mempertahankan `job_id`, membuat Celery delivery/task ID baru, dan melanjutkan dari checkpoint yang tersimpan.
- `Stop` mengubah job berjalan menjadi `STOP_REQUESTED`; task menetapkan `CANCELLED` pada checkpoint. Job antrean atau paused dapat dibatalkan langsung.
- `Restart` membuat Job baru dan mengisi `parent_job_id`; Job lama tidak ditimpa.

PostgreSQL adalah sumber kebenaran status Job. Celery revoke dikirim tanpa `terminate=True`; worker juga memeriksa status database agar task yang sudah terlanjur terkirim tidak mengerjakan Job yang telah dijeda/dibatalkan.

## Status

`QUEUED`, `RUNNING`, `PAUSE_REQUESTED`, `PAUSED`, `STOP_REQUESTED`,
`RESTARTING`, `SUCCESS`, `FAILED`, `CANCELLED`.

Status `PAUSED`, `PAUSE_REQUESTED`, dan `STOP_REQUESTED` tetap dianggap aktif oleh unique guard per dataset dan job type. Karena itu, Job paused tetap menahan slot proses dataset sampai di-resume atau di-stop.

## API admin

Semua endpoint memerlukan autentikasi admin berbasis cookie JWT.

| Method | Endpoint | Fungsi |
|---|---|---|
| POST | `/api/admin/jobs/{id}/pause` | Minta pause |
| POST | `/api/admin/jobs/{id}/resume` | Lanjutkan Job yang paused |
| POST | `/api/admin/jobs/{id}/stop` | Minta stop |
| POST | `/api/admin/jobs/{id}/restart` | Buat Job baru dari Job FAILED/CANCELLED |
| GET | `/api/admin/jobs/{id}` | Baca status dan checkpoint |
| GET | `/api/admin/jobs` | Daftar Job, termasuk filter status baru |

Contoh:
```http
POST /api/admin/jobs/22/pause
```
```json
{
  "data": {
    "id": 22,
    "status": "PAUSE_REQUESTED",
    "message": "Permintaan pause diterima; menunggu checkpoint aman."
  },
  "meta": {"status": "success"}
}
```

Respons `PAUSE_REQUESTED` bukan konfirmasi bahwa task sudah berhenti. Frontend harus polling `GET /api/admin/jobs/22` sampai status menjadi `PAUSED`.

## Checkpoint aktual

### PARAMETER_SEARCH
Checkpoint ada setelah:
1. Task mulai.
2. Perhitungan K-distance selesai.
3. Artefak Elbow tersimpan.
4. Setiap kombinasi epsilon/MinPts selesai atau terdeteksi sudah tersimpan.

Eksperimen yang telah tersimpan dipakai untuk melewati kombinasi yang selesai ketika resume. Perhitungan K-distance dan artefak Elbow dapat dihitung ulang/diganti secara idempotent saat resume.

### FINAL_CLUSTERING
Checkpoint ada sebelum DBSCAN fit dan setelah DBSCAN fit. Pause/stop yang diminta saat `fit_predict` berjalan baru diketahui setelah operasi fit selesai. Label hasil fit belum disimpan sebagai checkpoint artifact; jika pause terjadi setelah fit, resume mengulangi fit dari checkpoint aman sebelumnya. Tidak ada partial membership/profile yang dipublikasikan.

Ini adalah checkpoint tingkat tahap, bukan suspend/resume instruksi CPU di tengah `sklearn.DBSCAN.fit_predict`.

## Restart dan kompatibilitas Job lama

Restart hanya untuk `FAILED` atau `CANCELLED`. Job baru menyalin `input_payload`, memiliki ID baru, dan mereferensikan Job asal melalui `parent_job_id`. Untuk Final DBSCAN, restart membuat `DBSCANRun` baru berdasarkan eksperimen asal.

Job yang dibuat sebelum kolom `input_payload` tersedia tidak memiliki parameter lengkap yang dapat dijamin. Resume/restart otomatis ditolak untuk Job lama tanpa payload; buat Job baru dengan parameter yang sudah dikonfirmasi.

## Database migration

Jalankan setelah backup database:
```bash
flask --app app db upgrade
```

Migration menambah `parent_job_id`, `input_payload`, `checkpoint_data`, timestamp permintaan pause/stop, memperluas constraint status, dan memperbarui unique active-job index.

## Operasional worker

Worker harus dihentikan dengan warm shutdown (`CTRL+C` satu kali) sebelum mengganti source atau menjalankan migration. Jalankan ulang Flask dan Celery worker setelah deployment. Jangan menjalankan worker berbeda dengan queue yang sama saat pengujian.

## Batasan

- Pause/stop tidak menggunakan `terminate=True`.
- Pause bersifat cooperative; waktu respons bergantung checkpoint berikutnya.
- Untuk Final DBSCAN, satu operasi `fit_predict` tidak dapat dihentikan di tengah tanpa kehilangan state komputasinya.
- Status `PAUSED` tetap menahan slot dataset/job type sampai resume atau stop.
- Automated tests dan runtime verification wajib dilakukan sebelum fitur dinyatakan siap produksi.
