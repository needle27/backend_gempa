# SEISMAP Frontend Checkpoint Workflow (tanpa Git)

## Prinsip
- Backup STABLE dibuat sebelum patch baru diterapkan.
- Backup DEVELOPMENT boleh dibuat selama pengerjaan, tetapi tidak dianggap titik pemulihan.
- Versi baru hanya boleh ditandai STABLE setelah pengguna menjalankan `npm run typecheck && npm run build` dan menguji fungsi utama.
- Rollback selalu mempertahankan project yang gagal di folder bertanda `-failed-<timestamp>`.

## Sebelum memasang patch
Dari folder `seismap-frontend`:
```bash
bash scripts/frontend-checkpoint.sh backup stable
```

## Setelah patch terpasang
```bash
npm install
npm run typecheck && npm run build
```
Lakukan pengujian manual. Jika semuanya normal:
```bash
bash scripts/frontend-checkpoint.sh mark-stable
```

## Jika terjadi fatal error
Contoh kembali ke v0.4.34:
```bash
bash scripts/frontend-checkpoint.sh rollback 0.4.34
```

## Melihat backup
```bash
bash scripts/frontend-checkpoint.sh list
```

Backup disimpan di `../backups/frontend/`, di luar folder project aktif.
Jangan menghapus backup STABLE lama sebelum versi penggantinya benar-benar terverifikasi.
