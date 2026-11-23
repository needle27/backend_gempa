import { useEffect, useRef, useState } from 'react';
import { Activity, ArrowLeft, Atom, ChevronDown, ClipboardCheck, Database, FileClock, Gauge, ListTodo, LogOut, Menu, ShieldCheck, SlidersHorizontal, X } from 'lucide-react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { IS_PREVIEW_MODE } from '../config/env';
import { PreviewBanner } from '../components/ui';

const menu = [
  { to: '/admin', label: 'Dasbor', icon: Gauge, end: true },
  { to: '/admin/dataset', label: 'Dataset', icon: Database },
  { to: '/admin/validasi', label: 'Validasi', icon: ClipboardCheck },
  { to: '/admin/parameter', label: 'Pencarian Parameter', icon: SlidersHorizontal },
  { to: '/admin/jobs', label: 'Manajemen Proses', icon: ListTodo },
  { to: '/admin/dbscan-final', label: 'DBSCAN Final', icon: Atom },
  { to: '/admin/riwayat-run', label: 'Riwayat Eksekusi', icon: FileClock },
  { to: '/admin/audit-log', label: 'Log Aktivitas', icon: ShieldCheck },
];

export function AdminLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    setIsSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsSidebarOpen(false);
    };
    if (isSidebarOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isSidebarOpen]);

  const handleLogout = async () => {
    try { await signOut(); navigate('/admin/login'); }
    catch { /* Sesi tetap ditampilkan jika proses keluar tidak berhasil. */ }
  };

  return <div className="admin-shell">
    <a className="skip-link" href="#admin-main-content">Lewati ke konten utama</a>
    <div className="ambient ambient-one" /><div className="ambient ambient-two" />
    <PreviewBanner />

    {/* Backdrop for Mobile Sidebar Drawer */}
    {isSidebarOpen && (
      <div
        className="admin-sidebar-backdrop fixed inset-0 z-[1100] bg-black/50 backdrop-blur-sm lg:hidden"
        onClick={() => setIsSidebarOpen(false)}
        aria-hidden="true"
      />
    )}

    <aside className={`admin-sidebar glass-panel ${isSidebarOpen ? 'drawer-open translate-x-0' : 'drawer-closed -translate-x-full lg:translate-x-0'}`}>
      <div className="admin-sidebar-header">
        <NavLink to="/" className="brand-lockup sidebar-brand" onClick={() => setIsSidebarOpen(false)}>
          <span className="brand-mark"><Activity size={20} /></span>
          <span><strong>SEISMAP</strong><small>PUSAT KENDALI</small></span>
        </NavLink>
        <button
          type="button"
          className="admin-sidebar-close-btn lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-label="Tutup navigasi"
        >
          <X size={18} />
        </button>
      </div>
      <div className="sidebar-caption">RUANG KERJA</div>
      <nav className="admin-menu" aria-label="Navigasi administrasi">
        {menu.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setIsSidebarOpen(false)}
          >
            <item.icon size={17} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-status">
          <span className="status-pulse" />
          <div>
            <strong>Status sistem</strong>
            <small>{IS_PREVIEW_MODE ? 'Lingkungan pratinjau' : 'Terhubung ke sistem'}</small>
          </div>
        </div>
        <NavLink to="/" className="back-public" onClick={() => setIsSidebarOpen(false)}>
          <ArrowLeft size={15} />Kembali ke Publik
        </NavLink>
      </div>
    </aside>

    <section className="admin-main-area">
      <header className="admin-topbar glass-nav">
        <div className="topbar-left-group">
          <button
            type="button"
            className="admin-hamburger-btn lg:hidden"
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Buka navigasi menu admin"
          >
            <Menu size={20} />
          </button>
          <div>
            <span className="topbar-kicker">SEISMAP / ADMIN</span>
            <strong>Ruang Kerja Penelitian</strong>
          </div>
        </div>
        <div className="topbar-actions">
          <span className="topbar-env"><i />{IS_PREVIEW_MODE ? 'PRATINJAU' : 'MODE API'}</span>
          <div className="user-chip">
            <span className="avatar">{user?.username?.slice(0, 1).toUpperCase() || 'A'}</span>
            <span><strong>{user?.username || (IS_PREVIEW_MODE ? 'Akses Pratinjau' : 'Administrator')}</strong><small>{user?.role || (IS_PREVIEW_MODE ? 'Pratinjau saja' : 'Admin')}</small></span>
            <ChevronDown size={14} />
          </div>
          {!IS_PREVIEW_MODE && user && (
            <button className="icon-button" onClick={() => void handleLogout()} aria-label="Keluar">
              <LogOut size={17} />
            </button>
          )}
        </div>
      </header>
      <main className="admin-content" id="admin-main-content" tabIndex={-1} ref={mainRef}>
        <Outlet />
      </main>
    </section>
  </div>;
}
