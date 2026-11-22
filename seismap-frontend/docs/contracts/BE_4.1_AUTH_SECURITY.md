# Authentication, Cookie, CSRF, dan CORS

## 1. Mekanisme

Source BE 4.1 menetapkan:
- `JWT_TOKEN_LOCATION = ["cookies"]`
- `JWT_COOKIE_HTTPONLY = True`
- `JWT_COOKIE_CSRF_PROTECT = True`
- access token default 15 menit
- refresh token default 7 hari
- access cookie path `/`
- refresh cookie path `/api/auth/refresh`

Nama cookie:
- `access_token_cookie`
- `refresh_token_cookie`
- `csrf_access_token`
- `csrf_refresh_token`

Access dan refresh JWT bersifat HttpOnly. CSRF cookie disediakan agar frontend dapat menyalin nilainya ke header.

## 2. Endpoint sesi

| Endpoint | Syarat |
|---|---|
| `POST /api/auth/login` | Kredensial JSON; tidak memerlukan token |
| `GET /api/auth/me` | Access cookie |
| `POST /api/auth/refresh` | Refresh cookie + `X-CSRF-TOKEN` dari `csrf_refresh_token` |
| `POST /api/auth/logout` | Access cookie + `X-CSRF-TOKEN` dari `csrf_access_token` |

Semua endpoint admin memerlukan access cookie dan role `admin`. Untuk request mutasi admin, kirim header CSRF.

## 3. CORS

`FRONTEND_ORIGIN` menerima daftar origin dipisahkan koma. Backend:
- mengaktifkan `supports_credentials`;
- mengizinkan `Content-Type`, `X-CSRF-TOKEN`, `X-Request-ID`;
- mengekspos `X-Request-ID`;
- tidak mengizinkan wildcard `*`.

Frontend wajib memakai `credentials: "include"`.

## 4. Development vs production

Development lokal:
- `JWT_COOKIE_SECURE=false`
- `JWT_COOKIE_SAMESITE=Lax`
- origin frontend eksplisit seperti `http://localhost:5173`.

Production:
- `APP_ENV=production`
- `JWT_COOKIE_SECURE=true`
- secret minimal 32 karakter dan tidak boleh sama.
- gunakan HTTPS.
- jika frontend dan API benar-benar lintas-site, evaluasi `JWT_COOKIE_SAMESITE=None` bersama `Secure=true`.
- atur `FRONTEND_ORIGIN` ke origin frontend aktual, tanpa wildcard.

## 5. Catatan error

Route aplikasi menggunakan envelope `data/meta`. Flask-JWT-Extended dapat mengeluarkan response default berbentuk `{"msg": ...}` untuk kasus seperti cookie access tidak ada atau token invalid, sebagaimana terlihat pada pengujian lokal. Frontend sebaiknya memiliki parser fallback untuk `msg`.

Jangan memasukkan password, JWT, secret, atau cookie ke log browser maupun laporan bug.
