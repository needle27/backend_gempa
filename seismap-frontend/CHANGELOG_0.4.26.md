# SEISMAP Frontend v0.4.26

## Persistent Sidebar & Navigation Optimization
- Sidebar diekstrak menjadi komponen `AdminSidebar` bermemoisasi dan tetap berada di luar `Outlet`.
- Navigasi admin mempertahankan satu instance sidebar selama perpindahan antar-route admin.
- Active state dinyatakan eksplisit melalui callback `NavLink`.
- Semua item menu dikunci pada tinggi 43 px, lebar penuh, ukuran ikon 17 px, dan label satu baris.
- Indikator aktif diseragamkan untuk seluruh menu.
- Tidak mengubah endpoint, payload API, maupun backend.
