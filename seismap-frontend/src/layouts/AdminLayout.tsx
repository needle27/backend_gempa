import { useEffect, useRef, useState } from 'react';
import { Activity, ArrowLeft, Atom, ChevronDown, ClipboardCheck, Database, FileClock, Gauge, ListTodo, LogOut, Menu, ShieldCheck, SlidersHorizontal, X } from 'lucide-react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { IS_PREVIEW_MODE } from '../config/env';
import { ConfirmModal } from '../components/admin/ConfirmModal';
import { LanguageToggle } from '../components/LanguageToggle';
import { PreviewBanner } from '../components/ui';
import { useI18n } from '../i18n/LanguageContext';

export function AdminLayout() {
  const { user, signOut } = useAuth();
  const { t, tx } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);

  const menu = [
    { to: '/admin', label: t.adminNav.dashboard, icon: Gauge, end: true },
    { to: '/admin/dataset', label: t.adminNav.dataset, icon: Database },
    { to: '/admin/validasi', label: t.adminNav.validation, icon: ClipboardCheck },
    { to: '/admin/parameter', label: t.adminNav.parameter, icon: SlidersHorizontal },
    { to: '/admin/jobs', label: t.adminNav.jobs, icon: ListTodo },
    { to: '/admin/dbscan-final', label: t.adminNav.finalDbscan, icon: Atom },
    { to: '/admin/riwayat-run', label: t.adminNav.runHistory, icon: FileClock },
    { to: '/admin/audit-log', label: t.adminNav.auditLog, icon: ShieldCheck },
  ];

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
    setIsSidebarOpen(false);
    setShowLogoutConfirm(false);
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
    if (logoutBusy) return;
    setLogoutBusy(true);
    try {
      await signOut();
      setShowLogoutConfirm(false);
      navigate('/admin/login');
    } catch {
      setShowLogoutConfirm(false);
      /* Sesi tetap ditampilkan jika proses keluar tidak berhasil. */
    } finally {
      setLogoutBusy(false);
    }
  };

  return <div className="admin-shell">
    <a className="skip-link" href="#admin-main-content">{t.nav.skipMain}</a>
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

    <aside className={`admin-sidebar glass-panel ${isSidebarOpen ? 'drawer-open' : 'drawer-closed'}`}>
      <div className="admin-sidebar-header">
        <NavLink to="/" className="brand-lockup sidebar-brand" onClick={() => setIsSidebarOpen(false)}>
          <span className="brand-mark"><Activity size={20} /></span>
          <span><strong>SEISMAP</strong><small>{t.brand.adminSub}</small></span>
        </NavLink>
        <button
          type="button"
          className="admin-sidebar-close-btn lg:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-label={t.adminNav.closeNavAria}
        >
          <X size={18} />
        </button>
      </div>
      <div className="sidebar-caption">{t.adminNav.workspaceLabel}</div>
      <nav className="admin-menu" aria-label={t.adminNav.navAria}>
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
            <strong>{t.adminNav.systemStatus}</strong>
            <small>{IS_PREVIEW_MODE ? t.adminNav.previewEnv : t.adminNav.apiConnected}</small>
          </div>
        </div>
        <NavLink to="/" className="back-public" onClick={() => setIsSidebarOpen(false)}>
          <ArrowLeft size={15} />{t.adminNav.backToPublic}
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
            aria-label={t.adminNav.openNavAria}
          >
            <Menu size={20} />
          </button>
          <div>
            <span className="topbar-kicker">{t.adminNav.topbarKicker}</span>
            <strong>{t.adminNav.topbarTitle}</strong>
          </div>
        </div>
        <div className="topbar-actions">
          <span className="topbar-env"><i />{IS_PREVIEW_MODE ? t.adminNav.previewModeBadge : t.adminNav.apiModeBadge}</span>
          <div className="user-chip">
            <span className="avatar">{user?.username?.slice(0, 1).toUpperCase() || 'A'}</span>
            <span><strong>{user?.username || (IS_PREVIEW_MODE ? t.adminNav.previewUser : t.adminNav.defaultAdmin)}</strong><small>{user?.role || (IS_PREVIEW_MODE ? t.adminNav.previewRole : t.adminNav.defaultRole)}</small></span>
            <ChevronDown size={14} />
          </div>
          <div className="topbar-right-stack">
            <LanguageToggle className="lang-toggle-xs" />
            {!IS_PREVIEW_MODE && user && (
              <button
                type="button"
                className="icon-button topbar-logout-btn"
                onClick={() => setShowLogoutConfirm(true)}
                aria-label={t.adminNav.logoutAria}
                title={t.adminNav.logoutAria}
              >
                <LogOut size={16} />
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="admin-content" id="admin-main-content" tabIndex={-1} ref={mainRef}>
        <Outlet />
      </main>
    </section>

    <ConfirmModal
      isOpen={showLogoutConfirm}
      title={t.adminNav.logoutModalTitle}
      message={
        <>
          <p>
            {tx(
              <>Apakah Anda yakin ingin keluar dari ruang kerja administrator{user?.username ? <> (<strong>{user.username}</strong>)</> : ''}?</>,
              <>Are you sure you want to log out from the administrator workspace{user?.username ? <> (<strong>{user.username}</strong>)</> : ''}?</>,
            )}
          </p>
          <p>
            {tx(
              'Sesi Anda akan diakhiri dan Anda perlu masuk kembali untuk mengakses halaman admin.',
              'Your session will end and you will need to sign in again to access admin pages.',
            )}
          </p>
        </>
      }
      confirmLabel={t.adminNav.logoutConfirm}
      cancelLabel={t.adminNav.cancel}
      variant="danger"
      loading={logoutBusy}
      icon={<LogOut size={20} />}
      onConfirm={() => void handleLogout()}
      onCancel={() => {
        if (!logoutBusy) setShowLogoutConfirm(false);
      }}
    />
  </div>;
}
