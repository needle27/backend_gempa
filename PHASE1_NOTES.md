# Catatan audit implementasi Fase 1

## Keputusan yang sudah diterapkan

1. Backend mengikuti pola application factory.
2. Konfigurasi dibaca dari environment dan `.env`; secret tidak memiliki fallback bawaan.
3. `FRONTEND_ORIGIN` diparse sebagai daftar origin eksplisit dan wildcard ditolak.
4. Database dan Redis diperiksa terpisah pada endpoint readiness.
5. Response API mengikuti kontrak `data` dan `meta` pada blueprint.
6. Request diberi correlation ID melalui header `X-Request-ID`.
7. Exception tidak mengirim stack trace kepada client.
8. Celery task nantinya berjalan di Flask application context.
9. PostgreSQL dan Redis lokal disediakan melalui Compose; tidak ada volume data yang dibagikan ke container aplikasi.

## Batasan yang disengaja

- Belum membuat tabel penelitian karena seluruh model dan foreign key harus dibuat secara konsisten pada Fase 2.
- Belum membuat endpoint login karena model user, Argon2 service, token cookie, dan CSRF perlu diuji sebagai satu kesatuan pada Fase 3.
- Belum menjalankan migration karena metadata model belum tersedia.
- Belum mengklaim koneksi PostgreSQL/Redis berhasil; koneksi harus diverifikasi pada lingkungan pengguna melalui `/api/health/ready`.
- Belum mengklaim test lulus pada lingkungan target. Jalankan `pytest -q` setelah dependency terpasang.

## Pemeriksaan sebelum lanjut ke Fase 2

- [ ] Salin `.env.example` menjadi `.env`.
- [ ] Ganti seluruh placeholder secret/password.
- [ ] Pastikan `DATABASE_URL` cocok dengan kredensial PostgreSQL.
- [ ] Jalankan `docker compose up -d`.
- [ ] Instal `requirements.txt` dengan Python 3.12.
- [ ] Jalankan `pytest -q`.
- [ ] Pastikan `/api/health/ready` mengembalikan status sukses.
